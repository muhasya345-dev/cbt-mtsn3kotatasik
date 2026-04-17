import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  examSessions, answers, schedules, subjects, classes,
  students, users, questions,
} from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const gradeRecapRouter = new Hono<Env>();
gradeRecapRouter.use("*", requireRole("admin", "guru"));

gradeRecapRouter.get("/", async (c) => {
  const db = c.get("db");
  const examEventId = c.req.query("examEventId");
  const subjectId = c.req.query("subjectId");
  const classId = c.req.query("classId");

  if (!examEventId) return c.json({ error: "examEventId diperlukan" }, 400);

  const conditions = [eq(schedules.examEventId, examEventId)];
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
          const scoreResult = await db
            .select({
              totalScore: sql<number>`COALESCE(SUM(${answers.score}), 0)`,
              totalAnswered: sql<number>`COUNT(CASE WHEN ${answers.answerContent} IS NOT NULL AND ${answers.answerContent} != '' THEN 1 END)`,
              totalQuestions: sql<number>`COUNT(*)`,
            })
            .from(answers)
            .where(eq(answers.examSessionId, s.sessionId));

          const maxResult = await db
            .select({ maxScore: sql<number>`COALESCE(SUM(${questions.points}), 0)` })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .where(eq(answers.examSessionId, s.sessionId));

          const totalScore = scoreResult[0]?.totalScore ?? 0;
          const maxScore = maxResult[0]?.maxScore ?? 0;
          const rawScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;

          const essayUngraded = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .where(and(
              eq(answers.examSessionId, s.sessionId),
              eq(questions.type, "essay"),
              sql`${answers.score} IS NULL`
            ));

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

      return { ...sch, sessions: sessionsWithScores };
    })
  );

  return c.json(recapData);
});
