import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules, examEvents, subjects, classes, students, examSessions } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET active schedules for the current student's class
export async function GET() {
  try {
    const session = await requireRole("siswa");
    const db = await getDb();

    // Find student record
    const student = await db.select().from(students)
      .where(eq(students.userId, session.id)).limit(1);
    if (!student.length) {
      return NextResponse.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });
    }

    const classId = student[0].classId;
    const studentId = student[0].id;

    // Get active schedules for student's class
    const rows = await db
      .select({
        id: schedules.id,
        examEventName: examEvents.name,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        className: classes.name,
        date: schedules.date,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        durationMinutes: schedules.durationMinutes,
        isActive: schedules.isActive,
      })
      .from(schedules)
      .innerJoin(examEvents, eq(schedules.examEventId, examEvents.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .where(and(eq(schedules.classId, classId), eq(schedules.isActive, true)))
      .orderBy(schedules.date, schedules.startTime);

    // Check if student already has sessions for these schedules
    const result = [];
    for (const row of rows) {
      const existingSession = await db.select().from(examSessions)
        .where(and(eq(examSessions.scheduleId, row.id), eq(examSessions.studentId, studentId)))
        .limit(1);
      result.push({
        ...row,
        sessionStatus: existingSession.length ? existingSession[0].status : null,
        sessionId: existingSession.length ? existingSession[0].id : null,
      });
    }

    return NextResponse.json({ schedules: result, studentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
