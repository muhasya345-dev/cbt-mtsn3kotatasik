import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { examEvents } from "./exam-events";
import { students } from "./students";

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  examEventId: text("exam_event_id").notNull().references(() => examEvents.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const roomAssignments = sqliteTable("room_assignments", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => students.id),
  seatNumber: integer("seat_number").notNull(),
  participantNumber: text("participant_number").notNull(),
});
