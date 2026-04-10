import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  roomAssignments, rooms, students, users, classes, examEvents,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET: exam card data — students with room assignments for a given exam event
export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const examEventId = searchParams.get("examEventId");

    if (!examEventId) {
      return NextResponse.json({ error: "examEventId diperlukan" }, { status: 400 });
    }

    // Get exam event info
    const event = await db.select().from(examEvents)
      .where(eq(examEvents.id, examEventId)).limit(1);
    if (!event.length) {
      return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
    }

    // Get rooms for this event
    const eventRooms = await db.select().from(rooms)
      .where(eq(rooms.examEventId, examEventId))
      .orderBy(rooms.name);

    // Get room assignments with student details
    const cardData = [];
    for (const room of eventRooms) {
      const assignments = await db
        .select({
          seatNumber: roomAssignments.seatNumber,
          participantNumber: roomAssignments.participantNumber,
          studentName: users.fullName,
          nis: students.nis,
          className: classes.name,
          roomName: rooms.name,
        })
        .from(roomAssignments)
        .innerJoin(students, eq(roomAssignments.studentId, students.id))
        .innerJoin(users, eq(students.userId, users.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .innerJoin(rooms, eq(roomAssignments.roomId, rooms.id))
        .where(eq(roomAssignments.roomId, room.id))
        .orderBy(roomAssignments.seatNumber);

      for (const a of assignments) {
        cardData.push({
          participantNumber: a.participantNumber,
          studentName: a.studentName,
          nis: a.nis,
          className: a.className,
          roomName: a.roomName,
        });
      }
    }

    return NextResponse.json({
      examEvent: event[0],
      cards: cardData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
