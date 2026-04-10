import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules, students, examSessions, questions, teacherAssignments, answers } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// POST: verify token and start exam session
export async function POST(request: Request) {
  try {
    const session = await requireRole("siswa");
    const body = await request.json() as { scheduleId: string; token: string };

    if (!body.scheduleId || !body.token) {
      return NextResponse.json({ error: "Schedule ID dan token diperlukan" }, { status: 400 });
    }

    const db = await getDb();

    // Find student
    const student = await db.select().from(students)
      .where(eq(students.userId, session.id)).limit(1);
    if (!student.length) {
      return NextResponse.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });
    }

    // Verify schedule exists, is active, and token matches
    const schedule = await db.select().from(schedules)
      .where(eq(schedules.id, body.scheduleId)).limit(1);
    if (!schedule.length) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }
    if (!schedule[0].isActive) {
      return NextResponse.json({ error: "Ujian belum diaktifkan" }, { status: 403 });
    }
    if (schedule[0].token?.toUpperCase() !== body.token.toUpperCase()) {
      return NextResponse.json({ error: "Token salah" }, { status: 403 });
    }

    // Check if student already has an active session
    const existingSession = await db.select().from(examSessions)
      .where(and(
        eq(examSessions.scheduleId, body.scheduleId),
        eq(examSessions.studentId, student[0].id)
      )).limit(1);

    if (existingSession.length) {
      const s = existingSession[0];
      if (s.status === "submitted" || s.status === "auto_submitted") {
        return NextResponse.json({ error: "Anda sudah menyelesaikan ujian ini" }, { status: 400 });
      }
      // Resume existing session
      return NextResponse.json({
        sessionId: s.id,
        durationMinutes: schedule[0].durationMinutes,
        timeRemaining: s.timeRemaining ?? schedule[0].durationMinutes * 60,
        resumed: true,
      });
    }

    // Create new exam session
    const sessionId = createId();
    await db.insert(examSessions).values({
      id: sessionId,
      scheduleId: body.scheduleId,
      studentId: student[0].id,
      startedAt: new Date(),
      status: "in_progress",
      timeRemaining: schedule[0].durationMinutes * 60,
    });

    // Pre-create empty answer records for all questions in this assignment
    const assignment = await db.select().from(teacherAssignments)
      .where(and(
        eq(teacherAssignments.subjectId, schedule[0].subjectId),
        eq(teacherAssignments.classId, schedule[0].classId),
      )).limit(1);

    if (assignment.length) {
      const questionList = await db.select().from(questions)
        .where(eq(questions.assignmentId, assignment[0].id))
        .orderBy(questions.orderNumber);

      for (const q of questionList) {
        await db.insert(answers).values({
          id: createId(),
          examSessionId: sessionId,
          questionId: q.id,
          answerContent: null,
        });
      }
    }

    return NextResponse.json({
      sessionId,
      durationMinutes: schedule[0].durationMinutes,
      timeRemaining: schedule[0].durationMinutes * 60,
      resumed: false,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
