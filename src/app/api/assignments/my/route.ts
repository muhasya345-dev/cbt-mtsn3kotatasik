import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { teacherAssignments, subjects, classes, examEvents, questions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { sql } from "drizzle-orm";

// GET assignments for current teacher (guru)
export async function GET() {
  try {
    const session = await requireRole("guru");
    const db = await getDb();

    const rows = await db
      .select({
        id: teacherAssignments.id,
        examEventName: examEvents.name,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        className: classes.name,
        gradeLevel: classes.gradeLevel,
        status: teacherAssignments.status,
        createdAt: teacherAssignments.createdAt,
      })
      .from(teacherAssignments)
      .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
      .where(eq(teacherAssignments.teacherUserId, session.id))
      .orderBy(teacherAssignments.createdAt);

    // Count questions per assignment
    const result = [];
    for (const row of rows) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(eq(questions.assignmentId, row.id));
      result.push({ ...row, questionCount: countResult[0]?.count ?? 0 });
    }

    return NextResponse.json({ assignments: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
