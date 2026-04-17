import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { createDb } from "@/server/db";
import { sessionMiddleware } from "@/server/auth";
import type { Env } from "@/server/context";

import { authRouter } from "@/server/routes/auth";
import { usersRouter } from "@/server/routes/users";
import { studentsRouter } from "@/server/routes/students";
import { classesRouter } from "@/server/routes/classes";
import { subjectsRouter } from "@/server/routes/subjects";
import { examEventsRouter } from "@/server/routes/exam-events";
import { roomsRouter } from "@/server/routes/rooms";
import { assignmentsRouter } from "@/server/routes/assignments";
import { questionsRouter } from "@/server/routes/questions";
import { schedulesRouter } from "@/server/routes/schedules";
import { examRouter } from "@/server/routes/exam";
import { monitoringRouter } from "@/server/routes/monitoring";
import { gradeRecapRouter } from "@/server/routes/grade-recap";
import { gradeProcessingRouter } from "@/server/routes/grade-processing";
import { essayGradingRouter } from "@/server/routes/essay-grading";
import { examCardsRouter } from "@/server/routes/exam-cards";
import { dashboardStatsRouter } from "@/server/routes/dashboard-stats";

const app = new Hono<Env>().basePath("/api");

// Inject drizzle db instance from D1 binding
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

// Load session (if any) into context
app.use("*", sessionMiddleware);

app.route("/auth", authRouter);
app.route("/users", usersRouter);
app.route("/students", studentsRouter);
app.route("/classes", classesRouter);
app.route("/subjects", subjectsRouter);
app.route("/exam-events", examEventsRouter);
app.route("/rooms", roomsRouter);
app.route("/assignments", assignmentsRouter);
app.route("/questions", questionsRouter);
app.route("/schedules", schedulesRouter);
app.route("/exam", examRouter);
app.route("/monitoring", monitoringRouter);
app.route("/grade-recap", gradeRecapRouter);
app.route("/grade-processing", gradeProcessingRouter);
app.route("/essay-grading", essayGradingRouter);
app.route("/exam-cards", examCardsRouter);
app.route("/dashboard-stats", dashboardStatsRouter);

app.onError((err, c) => {
  console.error("[API error]", err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export const onRequest = handle(app);
