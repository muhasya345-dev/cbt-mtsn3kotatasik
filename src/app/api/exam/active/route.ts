import { NextResponse } from "next/server";
import { eq, and, sql, inArray } from "drizzle-orm";
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

    if (rows.length === 0) {
      return NextResponse.json({ schedules: [], studentId });
    }

    // Batch fetch all student's sessions for these schedules (1 query instead of N)
    const scheduleIds = rows.map((r) => r.id);
    const allSessions = await db.select().from(examSessions)
      .where(and(
        inArray(examSessions.scheduleId, scheduleIds),
        eq(examSessions.studentId, studentId)
      ));

    // Map sessions by scheduleId for quick lookup
    const sessionBySchedule = new Map(allSessions.map((s) => [s.scheduleId, s]));

    // Get submitted session IDs to batch-query scores
    const submittedSessions = allSessions.filter(
      (s) => s.status === "submitted" || s.status === "auto_submitted"
    );
    const submittedSessionIds = submittedSessions.map((s) => s.id);

    // Batch fetch essay ungraded counts + scores for all submitted sessions (2 queries instead of N*3)
    let ungradedMap = new Map<string, number>();
    let scoreMap = new Map<string, number>();

    if (submittedSessionIds.length > 0) {
      // Ungraded essay count per session
      const ungradedRows = await db
        .select({
          sessionId: answers.examSessionId,
          count: sql<number>`COUNT(*)`,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(and(
          inArray(answers.examSessionId, submittedSessionIds),
          eq(questions.type, "essay"),
          sql`${answers.score} IS NULL`
        ))
        .groupBy(answers.examSessionId);

      ungradedMap = new Map(ungradedRows.map((r) => [r.sessionId, r.count]));

      // Total score and max score per session
      const scoreRows = await db
        .select({
          sessionId: answers.examSessionId,
          totalScore: sql<number>`COALESCE(SUM(${answers.score}), 0)`,
          maxScore: sql<number>`COALESCE(SUM(${questions.points}), 0)`,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .where(inArray(answers.examSessionId, submittedSessionIds))
        .groupBy(answers.examSessionId);

      for (const row of scoreRows) {
        const ungraded = ungradedMap.get(row.sessionId) || 0;
        if (ungraded === 0 && row.maxScore > 0) {
          scoreMap.set(row.sessionId, Math.round((row.totalScore / row.maxScore) * 100 * 100) / 100);
        }
      }
    }

    // Build result
    const result = rows.map((row) => {
      const sess = sessionBySchedule.get(row.id);
      const essayUngraded = sess ? (ungradedMap.get(sess.id) || 0) : 0;
      const totalScore = sess ? (scoreMap.get(sess.id) ?? null) : null;

      return {
        ...row,
        sessionStatus: sess?.status ?? null,
        sessionId: sess?.id ?? null,
        essayUngraded,
        totalScore,
      };
    });

    return NextResponse.json({ schedules: result, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
