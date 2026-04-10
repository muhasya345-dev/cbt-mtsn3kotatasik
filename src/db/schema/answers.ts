import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { schedules } from "./schedules";
import { students } from "./students";
import { questions } from "./questions";

export const examSessions = sqliteTable("exam_sessions", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").notNull().references(() => schedules.id),
  studentId: text("student_id").notNull().references(() => students.id),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  status: text("status", {
    enum: ["in_progress", "submitted", "auto_submitted", "violation"],
  }).notNull().default("in_progress"),
  violationCount: integer("violation_count").notNull().default(0),
  timeRemaining: integer("time_remaining"), // seconds remaining
});

export const answers = sqliteTable("answers", {
  id: text("id").primaryKey(),
  examSessionId: text("exam_session_id").notNull().references(() => examSessions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id),
  answerContent: text("answer_content"),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  score: real("score"),
});

export const violationLogs = sqliteTable("violation_logs", {
  id: text("id").primaryKey(),
  examSessionId: text("exam_session_id").notNull().references(() => examSessions.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "tab_switch", "window_blur", etc.
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  details: text("details"),
});
