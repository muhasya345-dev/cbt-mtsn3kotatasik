import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules } from "@/db/schema";
import { requireRole } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const body = await request.json() as {
      date?: string;
      startTime?: string;
      durationMinutes?: number;
      proctorUserId?: string | null;
      isActive?: boolean;
      token?: string;
    };

    const db = await getDb();

    // Recalculate endTime if startTime or duration changes
    const updates: Record<string, unknown> = { ...body };
    if (body.startTime && body.durationMinutes) {
      const [h, m] = body.startTime.split(":").map(Number);
      const totalMin = h * 60 + m + body.durationMinutes;
      updates.endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
    }

    await db.update(schedules).set(updates).where(eq(schedules.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const db = await getDb();
    await db.delete(schedules).where(eq(schedules.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
