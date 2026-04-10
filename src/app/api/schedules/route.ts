import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schedules, examEvents, subjects, classes, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();

    const rows = await db
      .select({
        id: schedules.id,
        examEventId: schedules.examEventId,
        examEventName: examEvents.name,
        subjectId: schedules.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        classId: schedules.classId,
        className: classes.name,
        date: schedules.date,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        durationMinutes: schedules.durationMinutes,
        proctorUserId: schedules.proctorUserId,
        proctorName: users.fullName,
        token: schedules.token,
        isActive: schedules.isActive,
      })
      .from(schedules)
      .innerJoin(examEvents, eq(schedules.examEventId, examEvents.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classes, eq(schedules.classId, classes.id))
      .leftJoin(users, eq(schedules.proctorUserId, users.id))
      .orderBy(schedules.date, schedules.startTime);

    return NextResponse.json({ schedules: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as {
      examEventId: string;
      subjectId: string;
      classId: string;
      date: string;
      startTime: string;
      durationMinutes: number;
      proctorUserId?: string;
    };

    if (!body.examEventId || !body.subjectId || !body.classId || !body.date || !body.startTime || !body.durationMinutes) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    // Calculate endTime
    const [h, m] = body.startTime.split(":").map(Number);
    const totalMin = h * 60 + m + body.durationMinutes;
    const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

    const db = await getDb();
    const id = createId();

    await db.insert(schedules).values({
      id,
      examEventId: body.examEventId,
      subjectId: body.subjectId,
      classId: body.classId,
      date: body.date,
      startTime: body.startTime,
      endTime,
      durationMinutes: body.durationMinutes,
      proctorUserId: body.proctorUserId || null,
      token: generateToken(),
      isActive: false,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
