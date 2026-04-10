import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { examSessions, answers, questions } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET questions and answers for an exam session
export async function GET(request: Request) {
  try {
    await requireRole("siswa");
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId diperlukan" }, { status: 400 });
    }

    const db = await getDb();

    // Verify session exists and is in progress
    const examSession = await db.select().from(examSessions)
      .where(eq(examSessions.id, sessionId)).limit(1);
    if (!examSession.length) {
      return NextResponse.json({ error: "Sesi ujian tidak ditemukan" }, { status: 404 });
    }
    if (examSession[0].status !== "in_progress") {
      return NextResponse.json({ error: "Ujian sudah selesai" }, { status: 400 });
    }

    // Get answers with question data
    const answerRows = await db.select().from(answers)
      .where(eq(answers.examSessionId, sessionId));

    const result = [];
    for (const ans of answerRows) {
      const q = await db.select().from(questions)
        .where(eq(questions.id, ans.questionId)).limit(1);
      if (q.length) {
        result.push({
          answerId: ans.id,
          questionId: q[0].id,
          orderNumber: q[0].orderNumber,
          type: q[0].type,
          content: q[0].content,
          options: q[0].options,
          points: q[0].points,
          answerContent: ans.answerContent,
        });
      }
    }

    // Sort by orderNumber
    result.sort((a, b) => a.orderNumber - b.orderNumber);

    return NextResponse.json({
      questions: result,
      timeRemaining: examSession[0].timeRemaining,
      status: examSession[0].status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
