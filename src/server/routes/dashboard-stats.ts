import { Hono } from "hono";
import { eq, ne, count, and } from "drizzle-orm";
import {
  users, students, schedules, questions, examSessions,
  examEvents, subjects, classes, grades,
} from "@/db/schema";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const dashboardStatsRouter = new Hono<Env>();
dashboardStatsRouter.use("*", requireRole("admin"));

dashboardStatsRouter.get("/", async (c) => {
  const db = c.get("db");

  const [
    userCount,
    studentCount,
    scheduleCount,
    questionCount,
    activeScheduleCount,
    gradeCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(users).where(ne(users.role, "siswa")),
    db.select({ count: count() }).from(students),
    db.select({ count: count() }).from(schedules),
    db.select({ count: count() }).from(questions),
    db.select({ count: count() }).from(schedules).where(eq(schedules.isActive, true)),
    db.select({ count: count() }).from(grades),
  ]);

  const activeExams = await db
    .select({
      id: schedules.id,
      examEventName: examEvents.name,
      subjectName: subjects.name,
      className: classes.name,
      date: schedules.date,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      token: schedules.token,
    })
    .from(schedules)
    .innerJoin(examEvents, eq(schedules.examEventId, examEvents.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(eq(schedules.isActive, true))
    .orderBy(schedules.date, schedules.startTime);

  const activeExamsWithSessions = await Promise.all(
    activeExams.map(async (exam) => {
      const sessionCounts = await db
        .select({ count: count() })
        .from(examSessions)
        .where(and(
          eq(examSessions.scheduleId, exam.id),
          eq(examSessions.status, "in_progress")
        ));
      return { ...exam, inProgressCount: sessionCounts[0]?.count || 0 };
    })
  );

  return c.json({
    stats: {
      totalUser: userCount[0]?.count || 0,
      totalSiswa: studentCount[0]?.count || 0,
      jadwalUjian: scheduleCount[0]?.count || 0,
      bankSoal: questionCount[0]?.count || 0,
      ujianAktif: activeScheduleCount[0]?.count || 0,
      rekapNilai: gradeCount[0]?.count || 0,
    },
    activeExams: activeExamsWithSessions,
  });
});
