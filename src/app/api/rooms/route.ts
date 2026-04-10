import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rooms, roomAssignments, examEvents, students, users, classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const examEventId = searchParams.get("examEventId");

    let query = db
      .select({
        id: rooms.id,
        name: rooms.name,
        capacity: rooms.capacity,
        examEventId: rooms.examEventId,
        examEventName: examEvents.name,
      })
      .from(rooms)
      .innerJoin(examEvents, eq(rooms.examEventId, examEvents.id))
      .orderBy(rooms.name);

    const rows = examEventId
      ? await query.where(eq(rooms.examEventId, examEventId))
      : await query;

    return NextResponse.json({ rooms: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as {
      name: string;
      capacity: number;
      examEventId: string;
    };

    if (!body.name || !body.capacity || !body.examEventId) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const db = await getDb();
    const id = createId();

    await db.insert(rooms).values({
      id,
      name: body.name,
      capacity: body.capacity,
      examEventId: body.examEventId,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
