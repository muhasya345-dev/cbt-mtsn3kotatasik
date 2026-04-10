import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gradeLevel: integer("grade_level").notNull(), // 7, 8, or 9
  academicYear: text("academic_year").notNull(), // e.g. "2025/2026"
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
