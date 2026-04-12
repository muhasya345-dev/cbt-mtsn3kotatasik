import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules } from "@/db/schema";
import { requireRole } from "@/lib/auth";

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

// POST: regenerate token for a specific schedule
export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as { scheduleId: string };

    if (!body.scheduleId) {
      return NextResponse.json({ error: "scheduleId wajib" }, { status: 400 });
    }

    const db = await getDb();
    const newToken = generateToken();

    await db.update(schedules)
      .set({ token: newToken })
      .where(eq(schedules.id, body.scheduleId));

    return NextResponse.json({ success: true, token: newToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
