import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

    // Auto-grade MC and T/F questions
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
      // Essay questions are graded manually by teacher/admin
    }

    // Update session status
    await db.update(examSessions).set({
      status: body.auto ? "auto_submitted" : "submitted",
      submittedAt: new Date(),
      timeRemaining: 0,
    }).where(eq(examSessions.id, body.sessionId));

    return NextResponse.json({ success: true, status: body.auto ? "auto_submitted" : "submitted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
