import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { examSessions, answers, questions } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// POST: submit exam (manual or auto)
export async function POST(request: Request) {
  try {
    await requireRole("siswa");
    const body = await request.json() as {
      sessionId: string;
      auto?: boolean; // true if auto-submitted by timer
    };

    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId diperlukan" }, { status: 400 });
    }

    const db = await getDb();

    const session = await db.select().from(examSessions)
      .where(eq(examSessions.id, body.sessionId)).limit(1);
    if (!session.length) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (session[0].status !== "in_progress") {
      return NextResponse.json({ error: "Ujian sudah selesai" }, { status: 400 });
    }

    // Single JOIN query — get answers WITH question data (replaces N+1 loop)
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

    // Batch auto-grade MC and T/F
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

    // Batch update correct answers (score = points)
    // Group by same score to minimize queries
    const scoreGroups: Record<number, string[]> = {};
    for (const id of correctIds) {
      const score = scoreMap[id];
      if (!scoreGroups[score]) scoreGroups[score] = [];
      scoreGroups[score].push(id);
    }

    const updatePromises: Promise<unknown>[] = [];

    for (const [score, ids] of Object.entries(scoreGroups)) {
      updatePromises.push(
        db.update(answers).set({
          isCorrect: true,
          score: Number(score),
        }).where(inArray(answers.id, ids))
      );
    }

    // Batch update wrong answers (score = 0)
    if (wrongIds.length > 0) {
      updatePromises.push(
        db.update(answers).set({
          isCorrect: false,
          score: 0,
        }).where(inArray(answers.id, wrongIds))
      );
    }

    // Update session status
    updatePromises.push(
      db.update(examSessions).set({
        status: body.auto ? "auto_submitted" : "submitted",
        submittedAt: new Date(),
        timeRemaining: 0,
      }).where(eq(examSessions.id, body.sessionId))
    );

    // Execute all updates in parallel
    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, status: body.auto ? "auto_submitted" : "submitted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
