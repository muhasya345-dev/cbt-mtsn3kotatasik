import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { answers, examSessions } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// PUT: save answer + update time remaining
export async function PUT(request: Request) {
  try {
    await requireRole("siswa");
    const body = await request.json() as {
      answerId: string;
      answerContent: string;
      sessionId: string;
      timeRemaining: number;
    };

    if (!body.answerId || !body.sessionId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const db = await getDb();

    // Verify session is in progress
    const session = await db.select().from(examSessions)
      .where(eq(examSessions.id, body.sessionId)).limit(1);
    if (!session.length || session[0].status !== "in_progress") {
      return NextResponse.json({ error: "Sesi ujian tidak aktif" }, { status: 400 });
    }

    // Update answer
    await db.update(answers).set({
      answerContent: body.answerContent,
    }).where(eq(answers.id, body.answerId));

    // Update time remaining
    if (typeof body.timeRemaining === "number") {
      await db.update(examSessions).set({
        timeRemaining: Math.max(0, body.timeRemaining),
      }).where(eq(examSessions.id, body.sessionId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
