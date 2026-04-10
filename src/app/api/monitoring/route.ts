import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { examSessions, answers, schedules, subjects, classes, users, students, violationLogs } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET: monitoring data — active schedules with their exam sessions
export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    // If scheduleId given, return detailed session data for that schedule
    if (scheduleId) {
      const sessions = await db
        .select({
          sessionId: examSessions.id,
          studentId: examSessions.studentId,
          status: examSessions.status,
          startedAt: examSessions.startedAt,
          submittedAt: examSessions.submittedAt,
          violationCount: examSessions.violationCount,
          timeRemaining: examSessions.timeRemaining,
          studentName: users.fullName,
          nis: students.nis,
        })
        .from(examSessions)
        .innerJoin(students, eq(examSessions.studentId, students.id))
        .innerJoin(users, eq(students.userId, users.id))
        .where(eq(examSessions.scheduleId, scheduleId))
        .orderBy(users.fullName);

      // Get answer progress for each session
      const sessionsWithProgress = await Promise.all(
        sessions.map(async (s) => {
          const totalQ = await db
            .select({ count: sql<number>`count(*)` })
            .from(answers)
            .where(eq(answers.examSessionId, s.sessionId));

          const answeredQ = await db
            .select({ count: sql<number>`count(*)` })
            .from(answers)
            .where(
              and(
                eq(answers.examSessionId, s.sessionId),
                sql`${answers.answerContent} IS NOT NULL AND ${answers.answerContent} != ''`
              )
            );

          const recentViolations = await db
            .select({
              type: violationLogs.type,
              timestamp: violationLogs.timestamp,
            })
            .from(violationLogs)
            .where(eq(violationLogs.examSessionId, s.sessionId))
            .orderBy(sql`${violationLogs.timestamp} DESC`)
            .limit(5);

          return {
            ...s,
            totalQuestions: totalQ[0].count,
            answeredQuestions: answeredQ[0].count,
            recentViolations,
          };
        })
      );

      return NextResponse.json(sessionsWithProgress);
    }

    // Default: return active schedules overview
    const activeSchedules = await db
      .select({
        id: schedules.id,
        date: schedules.date,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        durationMinutes: schedules.durationMinutes,
        token: schedules.token,
        isActive: schedules.isActive,
        subjectName: subjects.name,
        className: classes.name,
        proctorName: users.fullName,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .leftJoin(users, eq(schedules.proctorUserId, users.id))
      .where(eq(schedules.isActive, true))
      .orderBy(schedules.date, schedules.startTime);

    // Count sessions per schedule
    const schedulesWithCounts = await Promise.all(
      activeSchedules.map(async (sch) => {
        const counts = await db
          .select({
            total: sql<number>`count(*)`,
            inProgress: sql<number>`sum(case when ${examSessions.status} = 'in_progress' then 1 else 0 end)`,
            submitted: sql<number>`sum(case when ${examSessions.status} IN ('submitted', 'auto_submitted') then 1 else 0 end)`,
          })
          .from(examSessions)
          .where(eq(examSessions.scheduleId, sch.id));

        return {
          ...sch,
          totalSessions: counts[0].total || 0,
          inProgress: counts[0].inProgress || 0,
          submitted: counts[0].submitted || 0,
        };
      })
    );

    return NextResponse.json(schedulesWithCounts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
