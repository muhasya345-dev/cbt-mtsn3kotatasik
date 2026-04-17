import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  schedules,
  examEvents,
  subjects,
  classes,
  students,
  examSessions,
  answers,
  questions,
  teacherAssignments,
  violationLogs,
} from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const examRouter = new Hono<Env>();
examRouter.use("*", requireRole("siswa"));

// GET /api/exam/active
examRouter.get("/active", async (c) => {
  const session = c.get("session")!;
  const db = c.get("db");

  const student = await db.select().from(students)
    .where(eq(students.userId, session.id)).limit(1);
  if (!student.length) {
    return c.json({ error: "Data siswa tidak ditemukan" }, 404);
  }
  const classId = student[0].classId;
  const studentId = student[0].id;

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

  if (rows.length === 0) return c.json({ schedules: [], studentId });

  const scheduleIds = rows.map((r) => r.id);
  const allSessions = await db.select().from(examSessions)
    .where(and(
      inArray(examSessions.scheduleId, scheduleIds),
      eq(examSessions.studentId, studentId)
    ));

  const sessionBySchedule = new Map(allSessions.map((s) => [s.scheduleId, s]));
  const submittedSessions = allSessions.filter(
    (s) => s.status === "submitted" || s.status === "auto_submitted"
  );
  const submittedSessionIds = submittedSessions.map((s) => s.id);

  let ungradedMap = new Map<string, number>();
  const scoreMap = new Map<string, number>();

  if (submittedSessionIds.length > 0) {
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

  return c.json({ schedules: result, studentId });
});

// POST /api/exam/start
examRouter.post("/start", async (c) => {
  const session = c.get("session")!;
  const body = await c.req.json<{ scheduleId: string; token: string }>();

  if (!body.scheduleId || !body.token) {
    return c.json({ error: "Schedule ID dan token diperlukan" }, 400);
  }

  const db = c.get("db");

  const student = await db.select().from(students)
    .where(eq(students.userId, session.id)).limit(1);
  if (!student.length) return c.json({ error: "Data siswa tidak ditemukan" }, 404);

  const schedule = await db.select().from(schedules)
    .where(eq(schedules.id, body.scheduleId)).limit(1);
  if (!schedule.length) return c.json({ error: "Jadwal tidak ditemukan" }, 404);
  if (!schedule[0].isActive) return c.json({ error: "Ujian belum diaktifkan" }, 403);
  if (schedule[0].token?.toUpperCase() !== body.token.toUpperCase()) {
    return c.json({ error: "Token salah" }, 403);
  }

  const existingSession = await db.select().from(examSessions)
    .where(and(
      eq(examSessions.scheduleId, body.scheduleId),
      eq(examSessions.studentId, student[0].id)
    )).limit(1);

  if (existingSession.length) {
    const s = existingSession[0];
    if (s.status === "submitted" || s.status === "auto_submitted") {
      return c.json({ error: "Anda sudah menyelesaikan ujian ini" }, 400);
    }
    return c.json({
      sessionId: s.id,
      durationMinutes: schedule[0].durationMinutes,
      timeRemaining: s.timeRemaining ?? schedule[0].durationMinutes * 60,
      resumed: true,
    });
  }

  const sessionId = createId();
  await db.insert(examSessions).values({
    id: sessionId,
    scheduleId: body.scheduleId,
    studentId: student[0].id,
    startedAt: new Date(),
    status: "in_progress",
    timeRemaining: schedule[0].durationMinutes * 60,
  });

  const assignment = await db.select().from(teacherAssignments)
    .where(and(
      eq(teacherAssignments.subjectId, schedule[0].subjectId),
      eq(teacherAssignments.classId, schedule[0].classId),
    )).limit(1);

  if (assignment.length) {
    const questionList = await db.select().from(questions)
      .where(eq(questions.assignmentId, assignment[0].id))
      .orderBy(questions.orderNumber);

    if (questionList.length > 0) {
      await db.insert(answers).values(
        questionList.map((q) => ({
          id: createId(),
          examSessionId: sessionId,
          questionId: q.id,
          answerContent: null,
        }))
      );
    }
  }

  return c.json({
    sessionId,
    durationMinutes: schedule[0].durationMinutes,
    timeRemaining: schedule[0].durationMinutes * 60,
    resumed: false,
  }, 201);
});

// GET /api/exam/questions
examRouter.get("/questions", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) return c.json({ error: "sessionId diperlukan" }, 400);

  const db = c.get("db");
  const examSession = await db.select().from(examSessions)
    .where(eq(examSessions.id, sessionId)).limit(1);
  if (!examSession.length) return c.json({ error: "Sesi ujian tidak ditemukan" }, 404);
  if (examSession[0].status !== "in_progress") {
    return c.json({ error: "Ujian sudah selesai" }, 400);
  }

  const result = await db
    .select({
      answerId: answers.id,
      questionId: questions.id,
      orderNumber: questions.orderNumber,
      type: questions.type,
      content: questions.content,
      options: questions.options,
      points: questions.points,
      answerContent: answers.answerContent,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.examSessionId, sessionId))
    .orderBy(questions.orderNumber);

  return c.json({
    questions: result,
    timeRemaining: examSession[0].timeRemaining,
    status: examSession[0].status,
  });
});

// PUT /api/exam/answer
examRouter.put("/answer", async (c) => {
  const body = await c.req.json<{
    answerId: string;
    answerContent: string;
    sessionId: string;
    timeRemaining: number;
  }>();

  if (!body.answerId || !body.sessionId) {
    return c.json({ error: "Data tidak lengkap" }, 400);
  }

  const db = c.get("db");
  const session = await db.select().from(examSessions)
    .where(eq(examSessions.id, body.sessionId)).limit(1);
  if (!session.length || session[0].status !== "in_progress") {
    return c.json({ error: "Sesi ujian tidak aktif" }, 400);
  }

  await db.update(answers).set({ answerContent: body.answerContent })
    .where(eq(answers.id, body.answerId));

  if (typeof body.timeRemaining === "number") {
    await db.update(examSessions).set({
      timeRemaining: Math.max(0, body.timeRemaining),
    }).where(eq(examSessions.id, body.sessionId));
  }

  return c.json({ success: true });
});

// POST /api/exam/submit
examRouter.post("/submit", async (c) => {
  const body = await c.req.json<{ sessionId: string; auto?: boolean }>();
  if (!body.sessionId) return c.json({ error: "sessionId diperlukan" }, 400);

  const db = c.get("db");
  const session = await db.select().from(examSessions)
    .where(eq(examSessions.id, body.sessionId)).limit(1);
  if (!session.length) return c.json({ error: "Sesi tidak ditemukan" }, 404);
  if (session[0].status !== "in_progress") {
    return c.json({ error: "Ujian sudah selesai" }, 400);
  }

  const answerRows = await db
    .select({
      answerId: answers.id,
      answerContent: answers.answerContent,
      questionType: questions.type,
      correctAnswer: questions.correctAnswer,
      points: questions.points,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.examSessionId, body.sessionId));

  const correctIds: string[] = [];
  const wrongIds: string[] = [];
  const scoreMap: Record<string, number> = {};

  for (const ans of answerRows) {
    if (ans.questionType === "multiple_choice" || ans.questionType === "true_false") {
      const isCorrect = ans.answerContent === ans.correctAnswer;
      if (isCorrect) {
        correctIds.push(ans.answerId);
        scoreMap[ans.answerId] = ans.points;
      } else {
        wrongIds.push(ans.answerId);
      }
    }
  }

  const scoreGroups: Record<number, string[]> = {};
  for (const id of correctIds) {
    const score = scoreMap[id];
    if (!scoreGroups[score]) scoreGroups[score] = [];
    scoreGroups[score].push(id);
  }

  const updatePromises: Promise<unknown>[] = [];

  for (const [score, ids] of Object.entries(scoreGroups)) {
    updatePromises.push(
      db.update(answers).set({ isCorrect: true, score: Number(score) })
        .where(inArray(answers.id, ids))
    );
  }

  if (wrongIds.length > 0) {
    updatePromises.push(
      db.update(answers).set({ isCorrect: false, score: 0 })
        .where(inArray(answers.id, wrongIds))
    );
  }

  updatePromises.push(
    db.update(examSessions).set({
      status: body.auto ? "auto_submitted" : "submitted",
      submittedAt: new Date(),
      timeRemaining: 0,
    }).where(eq(examSessions.id, body.sessionId))
  );

  await Promise.all(updatePromises);
  return c.json({ success: true, status: body.auto ? "auto_submitted" : "submitted" });
});

// POST /api/exam/sync
examRouter.post("/sync", async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    timeRemaining: number;
    answers: { answerId: string; answerContent: string }[];
  }>();

  if (!body.sessionId) return c.json({ error: "sessionId diperlukan" }, 400);

  const db = c.get("db");
  const session = await db.select().from(examSessions)
    .where(eq(examSessions.id, body.sessionId)).limit(1);
  if (!session.length || session[0].status !== "in_progress") {
    return c.json({ error: "Sesi ujian tidak aktif" }, 400);
  }

  const updatePromises: Promise<unknown>[] = [];
  for (const ans of body.answers) {
    updatePromises.push(
      db.update(answers).set({ answerContent: ans.answerContent })
        .where(eq(answers.id, ans.answerId))
    );
  }

  updatePromises.push(
    db.update(examSessions).set({
      timeRemaining: Math.max(0, body.timeRemaining),
    }).where(eq(examSessions.id, body.sessionId))
  );

  await Promise.all(updatePromises);
  return c.json({ success: true, synced: body.answers.length });
});

// POST /api/exam/violation
examRouter.post("/violation", async (c) => {
  const body = await c.req.json<{ sessionId: string; type: string; details?: string }>();
  if (!body.sessionId || !body.type) return c.json({ error: "Data tidak lengkap" }, 400);

  const db = c.get("db");
  await db.insert(violationLogs).values({
    id: createId(),
    examSessionId: body.sessionId,
    type: body.type,
    timestamp: new Date(),
    details: body.details || null,
  });

  const session = await db.select().from(examSessions)
    .where(eq(examSessions.id, body.sessionId)).limit(1);
  if (session.length) {
    await db.update(examSessions).set({
      violationCount: (session[0].violationCount || 0) + 1,
    }).where(eq(examSessions.id, body.sessionId));
  }

  return c.json({ success: true });
});
