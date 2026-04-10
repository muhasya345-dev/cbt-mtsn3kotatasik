import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  examSessions, answers, schedules, subjects, classes,
  students, users, questions, examEvents, grades,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET: rekap nilai — raw scores per student per schedule
export async function GET(request: Request) {
  try {
    const session = await requireRole("admin", "guru");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const examEventId = searchParams.get("examEventId");
    const subjectId = searchParams.get("subjectId");
    const classId = searchParams.get("classId");

    if (!examEventId) {
      return NextResponse.json({ error: "examEventId diperlukan" }, { status: 400 });
    }

    // Find schedules matching filters
    let scheduleFilter = eq(schedules.examEventId, examEventId);
    const conditions = [scheduleFilter];
    if (subjectId) conditions.push(eq(schedules.subjectId, subjectId));
    if (classId) conditions.push(eq(schedules.classId, classId));

    const matchedSchedules = await db
      .select({
        scheduleId: schedules.id,
        subjectName: subjects.name,
        className: classes.name,
        durationMinutes: schedules.durationMinutes,
        date: schedules.date,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    // For each schedule, get sessions with scores
    const recapData = await Promise.all(
      matchedSchedules.map(async (sch) => {
        const sessionRows = await db
          .select({
            sessionId: examSessions.id,
            studentId: examSessions.studentId,
            status: examSessions.status,
            violationCount: examSessions.violationCount,
            studentName: users.fullName,
            nis: students.nis,
          })
          .from(examSessions)
          .innerJoin(students, eq(examSessions.studentId, students.id))
          .innerJoin(users, eq(students.userId, users.id))
          .where(eq(examSessions.scheduleId, sch.scheduleId))
          .orderBy(users.fullName);

        const sessionsWithScores = await Promise.all(
          sessionRows.map(async (s) => {
            // Sum of points for answered questions
            const scoreResult = await db
              .select({
                totalScore: sql<number>`COALESCE(SUM(${answers.score}), 0)`,
                totalAnswered: sql<number>`COUNT(CASE WHEN ${answers.answerContent} IS NOT NULL AND ${answers.answerContent} != '' THEN 1 END)`,
                totalQuestions: sql<number>`COUNT(*)`,
              })
              .from(answers)
              .where(eq(answers.examSessionId, s.sessionId));

            // Max possible score
            const maxResult = await db
              .select({
                maxScore: sql<number>`COALESCE(SUM(${questions.points}), 0)`,
              })
              .from(answers)
              .innerJoin(questions, eq(answers.questionId, questions.id))
              .where(eq(answers.examSessionId, s.sessionId));

            const totalScore = scoreResult[0]?.totalScore ?? 0;
            const maxScore = maxResult[0]?.maxScore ?? 0;
            // Convert to 0-100 scale
            const rawScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;

            // Count essay questions needing manual grading
            const essayUngraded = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(answers)
              .innerJoin(questions, eq(answers.questionId, questions.id))
              .where(
                and(
                  eq(answers.examSessionId, s.sessionId),
                  eq(questions.type, "essay"),
                  sql`${answers.score} IS NULL`
                )
              );

            return {
              ...s,
              rawScore,
              maxScore,
              totalScore,
              totalAnswered: scoreResult[0]?.totalAnswered ?? 0,
              totalQuestions: scoreResult[0]?.totalQuestions ?? 0,
              essayUngraded: essayUngraded[0]?.count ?? 0,
            };
          })
        );

        return {
          ...sch,
          sessions: sessionsWithScores,
        };
      })
    );

    return NextResponse.json(recapData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
