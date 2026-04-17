import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const examEvents = sqliteTable("exam_events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g. "Ujian Akhir Semester"
  // "ganjil" | "genap" | "none" (tanpa semester)
  semester: text("semester", { enum: ["ganjil", "genap", "none"] }).notNull(),
  academicYear: text("academic_year").notNull(), // e.g. "2025/2026"
  // JSON-encoded array of class IDs yang ikut event ini. null = semua kelas.
  participatingClassIds: text("participating_class_ids"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
