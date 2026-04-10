import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { students, users, classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";

// GET: all students with user and class info
export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();

    const result = await db
      .select({
        id: students.id,
        userId: students.userId,
        nis: students.nis,
        nisn: students.nisn,
        fullName: users.fullName,
        username: users.username,
        gender: students.gender,
        birthPlace: students.birthPlace,
        birthDate: students.birthDate,
        classId: students.classId,
        className: classes.name,
        isActive: users.isActive,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .orderBy(classes.name, users.fullName);

    return NextResponse.json({ students: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
