import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  examSessions, answers, schedules, subjects, classes, users, students,
  violationLogs, questions,
} from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const monitoringRouter = new Hono<Env>();
monitoringRouter.use("*", requireRole("admin"));

monitoringRouter.get("/", async (c) => {
  const db = c.get("db");
  const scheduleId = c.req.query("scheduleId");

  if (scheduleId) {
    const sessions = await db
      .select({
        sessionId: examSessions.id,
        studentId: examSessions.studentId,
        status: examSessions.status,
        startedAt: examSessions.startedAt,
        submittedAt: examSessions.submittedAt,
        violationCount: examSessions.violationCount,
        timeRemaining: examSessions.timeRemaining,
        studentName: users.fullName,
        nis: students.nis,
      })
      .from(examSessions)
      .innerJoin(students, eq(examSessions.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(examSessions.scheduleId, scheduleId))
      .orderBy(users.fullName);

    const sessionsWithProgress = await Promise.all(
      sessions.map(async (s) => {
        const totalQ = await db.select({ count: sql<number>`count(*)` })
          .from(answers).where(eq(answers.examSessionId, s.sessionId));

        const answeredQ = await db.select({ count: sql<number>`count(*)` })
          .from(answers)
          .where(and(
            eq(answers.examSessionId, s.sessionId),
            sql`${answers.answerContent} IS NOT NULL AND ${answers.answerContent} != ''`
          ));

        const recentViolations = await db
          .select({ type: violationLogs.type, timestamp: violationLogs.timestamp })
          .from(violationLogs)
          .where(eq(violationLogs.examSessionId, s.sessionId))
          .orderBy(sql`${violationLogs.timestamp} DESC`)
          .limit(5);

        return {
          ...s,
          totalQuestions: totalQ[0].count,
          answeredQuestions: answeredQ[0].count,
          recentViolations,
        };
      })
    );

    return c.json(sessionsWithProgress);
  }

  const activeSchedules = await db
    .select({
      id: schedules.id,
      date: schedules.date,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      durationMinutes: schedules.durationMinutes,
      token: schedules.token,
      isActive: schedules.isActive,
      subjectName: subjects.name,
      className: classes.name,
      proctorName: users.fullName,
    })
    .from(schedules)
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .leftJoin(users, eq(schedules.proctorUserId, users.id))
    .where(eq(schedules.isActive, true))
    .orderBy(schedules.date, schedules.startTime);

  const schedulesWithCounts = await Promise.all(
    activeSchedules.map(async (sch) => {
      const counts = await db
        .select({
          total: sql<number>`count(*)`,
          inProgress: sql<number>`sum(case when ${examSessions.status} = 'in_progress' then 1 else 0 end)`,
          submitted: sql<number>`sum(case when ${examSessions.status} IN ('submitted', 'auto_submitted') then 1 else 0 end)`,
        })
        .from(examSessions)
        .where(eq(examSessions.scheduleId, sch.id));
      return {
        ...sch,
        totalSessions: counts[0].total || 0,
        inProgress: counts[0].inProgress || 0,
        submitted: counts[0].submitted || 0,
      };
    })
  );

  return c.json(schedulesWithCounts);
});

monitoringRouter.post("/force-submit", async (c) => {
  const body = await c.req.json<{ sessionId: string }>();
  if (!body.sessionId) return c.json({ error: "sessionId diperlukan" }, 400);

  const db = c.get("db");
  const session = await db.select().from(examSessions)
    .where(eq(examSessions.id, body.sessionId)).limit(1);
  if (!session.length) return c.json({ error: "Sesi tidak ditemukan" }, 404);
  if (session[0].status !== "in_progress") return c.json({ error: "Sesi sudah selesai" }, 400);

  const answerRows = await db.select().from(answers)
    .where(eq(answers.examSessionId, body.sessionId));

  for (const ans of answerRows) {
    const q = await db.select().from(questions)
      .where(eq(questions.id, ans.questionId)).limit(1);
    if (!q.length) continue;
    if (q[0].type === "multiple_choice" || q[0].type === "true_false") {
      const isCorrect = ans.answerContent === q[0].correctAnswer;
      await db.update(answers).set({
        isCorrect,
        score: isCorrect ? q[0].points : 0,
      }).where(eq(answers.id, ans.id));
    }
  }

  await db.update(examSessions).set({
    status: "auto_submitted",
    submittedAt: new Date(),
    timeRemaining: 0,
  }).where(eq(examSessions.id, body.sessionId));

  return c.json({ success: true });
});
