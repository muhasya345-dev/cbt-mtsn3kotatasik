import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { roomAssignments, rooms, students, users, classes, examEvents } from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const examCardsRouter = new Hono<Env>();
examCardsRouter.use("*", requireRole("admin"));

examCardsRouter.get("/", async (c) => {
  const db = c.get("db");
  const examEventId = c.req.query("examEventId");
  if (!examEventId) return c.json({ error: "examEventId diperlukan" }, 400);

  const event = await db.select().from(examEvents)
    .where(eq(examEvents.id, examEventId)).limit(1);
  if (!event.length) return c.json({ error: "Event tidak ditemukan" }, 404);

  const eventRooms = await db.select().from(rooms)
    .where(eq(rooms.examEventId, examEventId))
    .orderBy(rooms.name);

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

  return c.json({ examEvent: event[0], cards: cardData });
});
