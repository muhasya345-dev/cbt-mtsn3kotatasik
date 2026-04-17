import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  grades, examSessions, answers, schedules, students, users, questions,
} from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const gradeProcessingRouter = new Hono<Env>();
gradeProcessingRouter.use("*", requireRole("admin", "guru"));

gradeProcessingRouter.get("/", async (c) => {
  const db = c.get("db");
  const examEventId = c.req.query("examEventId");
  const subjectId = c.req.query("subjectId");
  const classId = c.req.query("classId");

  if (!examEventId || !subjectId || !classId) {
    return c.json({ error: "examEventId, subjectId, classId diperlukan" }, 400);
  }

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
    .where(and(
      eq(grades.examEventId, examEventId),
      eq(grades.subjectId, subjectId),
      eq(students.classId, classId)
    ))
    .orderBy(users.fullName);

  return c.json(existingGrades);
});

gradeProcessingRouter.post("/", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    examEventId: string;
    subjectId: string;
    classId: string;
    scalingTarget?: number;
    dailyWeight?: number;
    examWeight?: number;
    dailyGrades?: Record<string, number>;
  }>();

  if (!body.examEventId || !body.subjectId || !body.classId) {
    return c.json({ error: "examEventId, subjectId, classId diperlukan" }, 400);
  }

  const dailyWeight = body.dailyWeight ?? 0.5;
  const examWeight = body.examWeight ?? 0.5;

  const schedule = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(
      eq(schedules.examEventId, body.examEventId),
      eq(schedules.subjectId, body.subjectId),
      eq(schedules.classId, body.classId)
    ))
    .limit(1);

  if (!schedule.length) return c.json({ error: "Jadwal tidak ditemukan untuk kombinasi ini" }, 404);

  const sessionRows = await db
    .select({
      sessionId: examSessions.id,
      studentId: examSessions.studentId,
      status: examSessions.status,
    })
    .from(examSessions)
    .where(and(
      eq(examSessions.scheduleId, schedule[0].id),
      sql`${examSessions.status} IN ('submitted', 'auto_submitted')`
    ));

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

  const results = [];
  for (const s of scaledScores) {
    const dailyGrade = body.dailyGrades?.[s.studentId] ?? null;
    let finalGrade: number;
    if (dailyGrade !== null) {
      finalGrade = Math.round(dailyGrade * dailyWeight + s.scaledScore * examWeight);
    } else {
      finalGrade = Math.round(s.scaledScore);
    }

    const existing = await db
      .select({ id: grades.id })
      .from(grades)
      .where(and(
        eq(grades.studentId, s.studentId),
        eq(grades.subjectId, body.subjectId),
        eq(grades.examEventId, body.examEventId)
      ))
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

  return c.json({ success: true, processed: results.length, results });
});
