import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  grades, examSessions, answers, schedules, subjects, classes,
  students, users, questions, examEvents,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// GET: get processed grades for an exam event + subject + class
export async function GET(request: Request) {
  try {
    await requireRole("admin", "guru");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const examEventId = searchParams.get("examEventId");
    const subjectId = searchParams.get("subjectId");
    const classId = searchParams.get("classId");

    if (!examEventId || !subjectId || !classId) {
      return NextResponse.json({ error: "examEventId, subjectId, classId diperlukan" }, { status: 400 });
    }

    // Get existing grades
    const existingGrades = await db
      .select({
        id: grades.id,
        studentId: grades.studentId,
        rawScore: grades.rawScore,
        scaledScore: grades.scaledScore,
        dailyGrade: grades.dailyGrade,
        finalGrade: grades.finalGrade,
        dailyWeight: grades.dailyWeight,
        examWeight: grades.examWeight,
        studentName: users.fullName,
        nis: students.nis,
      })
      .from(grades)
      .innerJoin(students, eq(grades.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(
        and(
          eq(grades.examEventId, examEventId),
          eq(grades.subjectId, subjectId),
          eq(students.classId, classId)
        )
      )
      .orderBy(users.fullName);

    return NextResponse.json(existingGrades);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST: generate/update grades from exam results
export async function POST(request: Request) {
  try {
    await requireRole("admin", "guru");
    const db = await getDb();
    const body = await request.json() as {
      examEventId: string;
      subjectId: string;
      classId: string;
      scalingTarget?: number; // target KKM, e.g. 75
      dailyWeight?: number;  // 0-1, default 0.5
      examWeight?: number;   // 0-1, default 0.5
      dailyGrades?: Record<string, number>; // studentId -> dailyGrade
    };

    if (!body.examEventId || !body.subjectId || !body.classId) {
      return NextResponse.json({ error: "examEventId, subjectId, classId diperlukan" }, { status: 400 });
    }

    const dailyWeight = body.dailyWeight ?? 0.5;
    const examWeight = body.examWeight ?? 0.5;

    // Find matching schedule
    const schedule = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.examEventId, body.examEventId),
          eq(schedules.subjectId, body.subjectId),
          eq(schedules.classId, body.classId)
        )
      )
      .limit(1);

    if (!schedule.length) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan untuk kombinasi ini" }, { status: 404 });
    }

    // Get all submitted sessions for this schedule
    const sessionRows = await db
      .select({
        sessionId: examSessions.id,
        studentId: examSessions.studentId,
        status: examSessions.status,
      })
      .from(examSessions)
      .where(
        and(
          eq(examSessions.scheduleId, schedule[0].id),
          sql`${examSessions.status} IN ('submitted', 'auto_submitted')`
        )
      );

    // Calculate raw scores
    const rawScores: { studentId: string; rawScore: number }[] = [];
    for (const s of sessionRows) {
      const scoreResult = await db
        .select({ totalScore: sql<number>`COALESCE(SUM(${answers.score}), 0)` })
        .from(answers)
        .where(eq(answers.examSessionId, s.sessionId));

      const maxResult = await db
        .select({ maxScore: sql<number>`COALESCE(SUM(${questions.points}), 0)` })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(eq(answers.examSessionId, s.sessionId));

      const maxScore = maxResult[0]?.maxScore ?? 0;
      const rawScore = maxScore > 0
        ? Math.round((scoreResult[0].totalScore / maxScore) * 100 * 100) / 100
        : 0;

      rawScores.push({ studentId: s.studentId, rawScore });
    }

    // Apply scaling if target is set
    let scaledScores: { studentId: string; rawScore: number; scaledScore: number }[];
    if (body.scalingTarget && rawScores.length > 0) {
      const maxRaw = Math.max(...rawScores.map((r) => r.rawScore));
      const scalingFactor = maxRaw > 0 ? body.scalingTarget / maxRaw : 1;

      scaledScores = rawScores.map((r) => ({
        ...r,
        scaledScore: Math.min(100, Math.round(r.rawScore * scalingFactor * 100) / 100),
      }));
    } else {
      scaledScores = rawScores.map((r) => ({ ...r, scaledScore: r.rawScore }));
    }

    // Upsert grades
    const results = [];
    for (const s of scaledScores) {
      const dailyGrade = body.dailyGrades?.[s.studentId] ?? null;

      // Calculate final grade if dailyGrade is available
      let finalGrade: number | null = null;
      if (dailyGrade !== null) {
        finalGrade = Math.round(dailyGrade * dailyWeight + s.scaledScore * examWeight);
      } else {
        finalGrade = Math.round(s.scaledScore);
      }

      // Check if grade already exists
      const existing = await db
        .select({ id: grades.id })
        .from(grades)
        .where(
          and(
            eq(grades.studentId, s.studentId),
            eq(grades.subjectId, body.subjectId),
            eq(grades.examEventId, body.examEventId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db.update(grades).set({
          rawScore: s.rawScore,
          scaledScore: s.scaledScore,
          dailyGrade,
          finalGrade,
          dailyWeight,
          examWeight,
        }).where(eq(grades.id, existing[0].id));
        results.push({ ...s, dailyGrade, finalGrade, updated: true });
      } else {
        const id = createId();
        await db.insert(grades).values({
          id,
          studentId: s.studentId,
          subjectId: body.subjectId,
          examEventId: body.examEventId,
          rawScore: s.rawScore,
          scaledScore: s.scaledScore,
          dailyGrade,
          finalGrade,
          dailyWeight,
          examWeight,
        });
        results.push({ ...s, dailyGrade, finalGrade, created: true });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
