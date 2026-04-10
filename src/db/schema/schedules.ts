import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { examEvents } from "./exam-events";
import { subjects } from "./subjects";
import { classes } from "./classes";
import { users } from "./users";

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  examEventId: text("exam_event_id").notNull().references(() => examEvents.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  classId: text("class_id").notNull().references(() => classes.id),
  date: text("date").notNull(), // ISO date: YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  durationMinutes: integer("duration_minutes").notNull(),
  proctorUserId: text("proctor_user_id").references(() => users.id),
  token: text("token"), // 6-char alphanumeric token
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
