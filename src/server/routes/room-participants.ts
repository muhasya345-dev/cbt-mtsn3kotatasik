import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { roomAssignments, rooms, students, users, classes, examEvents } from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const roomParticipantsRouter = new Hono<Env>();
roomParticipantsRouter.use("*", requireRole("admin"));

/**
 * GET /api/room-participants?examEventId=xxx
 * Returns exam event metadata + each room with its list of participants
 * (sorted by class name, then by full name).
 */
roomParticipantsRouter.get("/", async (c) => {
  const db = c.get("db");
  const examEventId = c.req.query("examEventId");
  if (!examEventId) return c.json({ error: "examEventId diperlukan" }, 400);

  const ev = await db
    .select()
    .from(examEvents)
    .where(eq(examEvents.id, examEventId))
    .limit(1);
  if (!ev.length) return c.json({ error: "Event tidak ditemukan" }, 404);

  const eventRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.examEventId, examEventId))
    .orderBy(rooms.name);

  const result = [];
  for (const room of eventRooms) {
    const participants = await db
      .select({
        nis: students.nis,
        nisn: students.nisn,
        fullName: users.fullName,
        className: classes.name,
        seatNumber: roomAssignments.seatNumber,
      })
      .from(roomAssignments)
      .innerJoin(students, eq(roomAssignments.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(roomAssignments.roomId, room.id))
      .orderBy(classes.name, users.fullName);

    result.push({
      roomId: room.id,
      roomName: room.name,
      capacity: room.capacity,
      participants: participants.map((p) => ({
        nis: p.nis,
        nisn: p.nisn ?? "-",
        fullName: p.fullName,
        className: p.className,
      })),
    });
  }

  return c.json({
    examEvent: {
      id: ev[0].id,
      name: ev[0].name,
      semester: ev[0].semester,
      academicYear: ev[0].academicYear,
    },
    rooms: result,
  });
});
