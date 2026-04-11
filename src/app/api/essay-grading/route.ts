import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  answers, questions, teacherAssignments, examSessions,
  schedules, students, users, subjects, classes, examEvents,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET: essay answers that need grading, filtered by teacher's assignments
export async function GET(request: Request) {
  try {
    const session = await requireRole("admin", "guru");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    // Get teacher's assignments (guru only sees own, admin sees all)
    let assignmentFilter;
    if (session.role === "guru") {
      assignmentFilter = eq(teacherAssignments.teacherUserId, session.id);
    } else if (assignmentId) {
      assignmentFilter = eq(teacherAssignments.id, assignmentId);
    } else {
      // Admin: all assignments
      assignmentFilter = undefined;
    }

    // Get assignments with essay questions
    const assignmentsQuery = assignmentFilter
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
        .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id));

    const assignmentRows = await assignmentsQuery;

    // For each assignment, find essay questions and their ungraded answers
    const result = [];
    for (const asgn of assignmentRows) {
      // Get essay questions for this assignment
      const essayQuestions = await db.select()
        .from(questions)
        .where(and(
          eq(questions.assignmentId, asgn.id),
          eq(questions.type, "essay")
        ))
        .orderBy(questions.orderNumber);

      if (essayQuestions.length === 0) continue;

      // Get answers for these essay questions that need grading
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

        for (const ans of answerRows) {
          essayAnswers.push(ans);
        }
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

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT: submit score for a single essay answer
export async function PUT(request: Request) {
  try {
    const session = await requireRole("admin", "guru");
    const db = await getDb();
    const body = await request.json() as {
      answerId: string;
      score: number;
    };

    if (!body.answerId || body.score === undefined || body.score === null) {
      return NextResponse.json({ error: "answerId dan score diperlukan" }, { status: 400 });
    }

    // Get the answer and verify ownership (guru must own the assignment)
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

    if (!answerRow.length) {
      return NextResponse.json({ error: "Jawaban tidak ditemukan" }, { status: 404 });
    }

    // Guru can only grade their own assignments
    if (session.role === "guru" && answerRow[0].teacherUserId !== session.id) {
      return NextResponse.json({ error: "Anda tidak memiliki akses ke penugasan ini" }, { status: 403 });
    }

    // Validate score range (0 to max points)
    const maxPoints = answerRow[0].questionPoints;
    if (body.score < 0 || body.score > maxPoints) {
      return NextResponse.json({ error: `Score harus antara 0 dan ${maxPoints}` }, { status: 400 });
    }

    // Update the answer score
    await db.update(answers).set({
      score: body.score,
      isCorrect: body.score > 0,
    }).where(eq(answers.id, body.answerId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
