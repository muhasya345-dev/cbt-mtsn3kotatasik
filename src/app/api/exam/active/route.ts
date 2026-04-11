import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules, examEvents, subjects, classes, students, examSessions, answers, questions } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET active schedules for the current student's class
export async function GET() {
  try {
    const session = await requireRole("siswa");
    const db = await getDb();

    // Find student record
    const student = await db.select().from(students)
      .where(eq(students.userId, session.id)).limit(1);
    if (!student.length) {
      return NextResponse.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });
    }

    const classId = student[0].classId;
    const studentId = student[0].id;

    // Get active schedules for student's class
    const rows = await db
      .select({
        id: schedules.id,
        examEventName: examEvents.name,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        className: classes.name,
        date: schedules.date,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        durationMinutes: schedules.durationMinutes,
        isActive: schedules.isActive,
      })
      .from(schedules)
      .innerJoin(examEvents, eq(schedules.examEventId, examEvents.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .where(and(eq(schedules.classId, classId), eq(schedules.isActive, true)))
      .orderBy(schedules.date, schedules.startTime);

    // Check if student already has sessions for these schedules
    const result = [];
    for (const row of rows) {
      const existingSession = await db.select().from(examSessions)
        .where(and(eq(examSessions.scheduleId, row.id), eq(examSessions.studentId, studentId)))
        .limit(1);
      // Check if there are ungraded essay answers for this session
      let essayUngraded = 0;
      let totalScore: number | null = null;
      if (existingSession.length && (existingSession[0].status === "submitted" || existingSession[0].status === "auto_submitted")) {
        const ungradedResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(answers)
          .innerJoin(questions, eq(answers.questionId, questions.id))
          .where(and(
            eq(answers.examSessionId, existingSession[0].id),
            eq(questions.type, "essay"),
            sql`${answers.score} IS NULL`
          ));
        essayUngraded = ungradedResult[0]?.count ?? 0;

        // If all graded, calculate total score
        if (essayUngraded === 0) {
          const scoreResult = await db
            .select({
              totalScore: sql<number>`COALESCE(SUM(${answers.score}), 0)`,
            })
            .from(answers)
            .where(eq(answers.examSessionId, existingSession[0].id));
          const maxResult = await db
            .select({
              maxScore: sql<number>`COALESCE(SUM(${questions.points}), 0)`,
            })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .where(eq(answers.examSessionId, existingSession[0].id));
          const maxScore = maxResult[0]?.maxScore ?? 0;
          totalScore = maxScore > 0
            ? Math.round((scoreResult[0].totalScore / maxScore) * 100 * 100) / 100
            : 0;
        }
      }

      result.push({
        ...row,
        sessionStatus: existingSession.length ? existingSession[0].status : null,
        sessionId: existingSession.length ? existingSession[0].id : null,
        essayUngraded,
        totalScore,
      });
    }

    return NextResponse.json({ schedules: result, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
