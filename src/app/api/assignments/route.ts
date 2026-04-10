import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { teacherAssignments, users, subjects, classes, examEvents } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();

    const rows = await db
      .select({
        id: teacherAssignments.id,
        examEventId: teacherAssignments.examEventId,
        examEventName: examEvents.name,
        teacherUserId: teacherAssignments.teacherUserId,
        teacherName: users.fullName,
        subjectId: teacherAssignments.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        classId: teacherAssignments.classId,
        className: classes.name,
        gradeLevel: classes.gradeLevel,
        status: teacherAssignments.status,
        createdAt: teacherAssignments.createdAt,
      })
      .from(teacherAssignments)
      .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
      .innerJoin(users, eq(teacherAssignments.teacherUserId, users.id))
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
      .orderBy(teacherAssignments.createdAt);

    return NextResponse.json({ assignments: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as {
      examEventId: string;
      teacherUserId: string;
      subjectId: string;
      classId: string;
    };

    if (!body.examEventId || !body.teacherUserId || !body.subjectId || !body.classId) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const db = await getDb();
    const id = createId();

    await db.insert(teacherAssignments).values({
      id,
      examEventId: body.examEventId,
      teacherUserId: body.teacherUserId,
      subjectId: body.subjectId,
      classId: body.classId,
      status: "pending",
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
