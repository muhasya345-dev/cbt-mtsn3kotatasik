import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { students } from "./students";
import { subjects } from "./subjects";
import { examEvents } from "./exam-events";

export const grades = sqliteTable("grades", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  subjectId: text("subject_id").notNull().references(() => subjects.id),
  examEventId: text("exam_event_id").notNull().references(() => examEvents.id),
  rawScore: real("raw_score"), // Nilai asli ujian
  scaledScore: real("scaled_score"), // Nilai setelah katrol
  dailyGrade: real("daily_grade"), // Nilai harian
  finalGrade: integer("final_grade"), // Nilai rapor (bilangan bulat)
  dailyWeight: real("daily_weight").default(0.5),
  examWeight: real("exam_weight").default(0.5),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
