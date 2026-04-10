import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const examEvents = sqliteTable("exam_events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Ujian Akhir Semester"
  semester: text("semester", { enum: ["ganjil", "genap"] }).notNull(),
  academicYear: text("academic_year").notNull(), // e.g. "2025/2026"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
