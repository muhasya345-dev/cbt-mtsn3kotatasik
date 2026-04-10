import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { examSessions, violationLogs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// POST: log a violation
export async function POST(request: Request) {
  try {
    await requireRole("siswa");
    const body = await request.json() as {
      sessionId: string;
      type: string;
      details?: string;
    };

    if (!body.sessionId || !body.type) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const db = await getDb();

    // Log violation
    await db.insert(violationLogs).values({
      id: createId(),
      examSessionId: body.sessionId,
      type: body.type,
      timestamp: new Date(),
      details: body.details || null,
    });

    // Increment violation count
    const session = await db.select().from(examSessions)
      .where(eq(examSessions.id, body.sessionId)).limit(1);
    if (session.length) {
      await db.update(examSessions).set({
        violationCount: (session[0].violationCount || 0) + 1,
      }).where(eq(examSessions.id, body.sessionId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
