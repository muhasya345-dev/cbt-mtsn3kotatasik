import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import {
  answers, questions, teacherAssignments, examSessions,
  students, users, subjects, classes, examEvents,
} from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const essayGradingRouter = new Hono<Env>();
essayGradingRouter.use("*", requireRole("admin", "guru"));

essayGradingRouter.get("/", async (c) => {
  const session = c.get("session")!;
  const db = c.get("db");
  const assignmentId = c.req.query("assignmentId");

  let assignmentFilter;
  if (session.role === "guru") {
    assignmentFilter = eq(teacherAssignments.teacherUserId, session.id);
  } else if (assignmentId) {
    assignmentFilter = eq(teacherAssignments.id, assignmentId);
  } else {
    assignmentFilter = undefined;
  }

  const assignmentRows = await (assignmentFilter
    ? db.select({
        id: teacherAssignments.id,
        subjectName: subjects.name,
        className: classes.name,
        examEventName: examEvents.name,
        examEventId: teacherAssignments.examEventId,
        status: teacherAssignments.status,
      })
      .from(teacherAssignments)
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
      .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
      .where(assignmentFilter)
    : db.select({
        id: teacherAssignments.id,
        subjectName: subjects.name,
        className: classes.name,
        examEventName: examEvents.name,
        examEventId: teacherAssignments.examEventId,
        status: teacherAssignments.status,
      })
      .from(teacherAssignments)
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
      .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
  );

  const result = [];
  for (const asgn of assignmentRows) {
    const essayQuestions = await db.select()
      .from(questions)
      .where(and(
        eq(questions.assignmentId, asgn.id),
        eq(questions.type, "essay")
      ))
      .orderBy(questions.orderNumber);

    if (essayQuestions.length === 0) continue;

    const essayAnswers = [];
    for (const q of essayQuestions) {
      const answerRows = await db
        .select({
          answerId: answers.id,
          answerContent: answers.answerContent,
          score: answers.score,
          isCorrect: answers.isCorrect,
          questionId: answers.questionId,
          questionContent: questions.content,
          questionPoints: questions.points,
          orderNumber: questions.orderNumber,
          sessionId: examSessions.id,
          studentName: users.fullName,
          nis: students.nis,
          sessionStatus: examSessions.status,
        })
        .from(answers)
        .innerJoin(questions, eq(answers.questionId, questions.id))
        .innerJoin(examSessions, eq(answers.examSessionId, examSessions.id))
        .innerJoin(students, eq(examSessions.studentId, students.id))
        .innerJoin(users, eq(students.userId, users.id))
        .where(and(
          eq(answers.questionId, q.id),
          sql`${examSessions.status} IN ('submitted', 'auto_submitted')`
        ))
        .orderBy(users.fullName);

      for (const ans of answerRows) essayAnswers.push(ans);
    }

    if (essayAnswers.length === 0) continue;

    const ungradedCount = essayAnswers.filter((a) => a.score === null).length;
    const gradedCount = essayAnswers.filter((a) => a.score !== null).length;

    result.push({
      assignmentId: asgn.id,
      subjectName: asgn.subjectName,
      className: asgn.className,
      examEventName: asgn.examEventName,
      totalEssayAnswers: essayAnswers.length,
      ungradedCount,
      gradedCount,
      answers: essayAnswers,
    });
  }

  return c.json(result);
});

essayGradingRouter.put("/", async (c) => {
  const session = c.get("session")!;
  const db = c.get("db");
  const body = await c.req.json<{ answerId: string; score: number }>();

  if (!body.answerId || body.score === undefined || body.score === null) {
    return c.json({ error: "answerId dan score diperlukan" }, 400);
  }

  const answerRow = await db
    .select({
      answerId: answers.id,
      questionId: answers.questionId,
      assignmentId: questions.assignmentId,
      questionPoints: questions.points,
      teacherUserId: teacherAssignments.teacherUserId,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(teacherAssignments, eq(questions.assignmentId, teacherAssignments.id))
    .where(eq(answers.id, body.answerId))
    .limit(1);

  if (!answerRow.length) return c.json({ error: "Jawaban tidak ditemukan" }, 404);

  if (session.role === "guru" && answerRow[0].teacherUserId !== session.id) {
    return c.json({ error: "Anda tidak memiliki akses ke penugasan ini" }, 403);
  }

  const maxPoints = answerRow[0].questionPoints;
  if (body.score < 0 || body.score > maxPoints) {
    return c.json({ error: `Score harus antara 0 dan ${maxPoints}` }, 400);
  }

  await db.update(answers).set({
    score: body.score,
    isCorrect: body.score > 0,
  }).where(eq(answers.id, body.answerId));

  return c.json({ success: true });
});
