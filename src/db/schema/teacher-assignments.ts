import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { subjects } from "./subjects";
import { classes } from "./classes";
import { examEvents } from "./exam-events";

export const teacherAssignments = sqliteTable("teacher_assignments", {
  id: text("id").primaryKey(),
  examEventId: text("exam_event_id").notNull().references(() => examEvents.id),
  teacherUserId: text("teacher_user_id").notNull().references(() => users.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  classId: text("class_id").notNull().references(() => classes.id),
  status: text("status", { enum: ["pending", "submitted", "approved"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
