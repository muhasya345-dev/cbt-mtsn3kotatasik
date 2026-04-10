import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { teacherAssignments } from "./teacher-assignments";

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id").notNull().references(() => teacherAssignments.id, { onDelete: "cascade" }),
  orderNumber: integer("order_number").notNull(),
  type: text("type", { enum: ["multiple_choice", "true_false", "essay"] }).notNull(),
  content: text("content").notNull(), // TipTap JSON
  options: text("options"), // JSON array for MC/TF choices
  correctAnswer: text("correct_answer"), // For MC: option key, TF: "true"/"false", Essay: null
  points: real("points").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
