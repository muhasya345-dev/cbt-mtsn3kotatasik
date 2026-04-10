import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { classes } from "./classes";

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nis: text("nis").notNull().unique(),
  nisn: text("nisn").unique(),
  classId: text("class_id").notNull().references(() => classes.id),
  gender: text("gender", { enum: ["L", "P"] }).notNull(),
  birthPlace: text("birth_place"),
  birthDate: text("birth_date"),
  photoUrl: text("photo_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
