import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { students, users } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";

// PUT: update student info
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const body = await request.json() as {
      fullName?: string;
      nis?: string;
      nisn?: string;
      classId?: string;
      gender?: "L" | "P";
      birthPlace?: string;
      birthDate?: string;
      isActive?: boolean;
      password?: string; // reset password
    };

    const db = await getDb();

    // Get student to find userId
    const student = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (!student.length) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    // Update user record
    const userUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (body.fullName) userUpdate.fullName = body.fullName;
    if (body.isActive !== undefined) userUpdate.isActive = body.isActive;
    if (body.password) {
      userUpdate.passwordHash = await hashPassword(body.password);
      userUpdate.plainPassword = body.password;
    }
    await db.update(users).set(userUpdate).where(eq(users.id, student[0].userId));

    // Update student record
    const studentUpdate: Record<string, unknown> = {};
    if (body.nis) studentUpdate.nis = body.nis;
    if (body.nisn !== undefined) studentUpdate.nisn = body.nisn || null;
    if (body.classId) studentUpdate.classId = body.classId;
    if (body.gender) studentUpdate.gender = body.gender;
    if (body.birthPlace !== undefined) studentUpdate.birthPlace = body.birthPlace || null;
    if (body.birthDate !== undefined) studentUpdate.birthDate = body.birthDate || null;

    if (Object.keys(studentUpdate).length > 0) {
      await db.update(students).set(studentUpdate).where(eq(students.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE: delete student and user account
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const db = await getDb();

    const student = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (!student.length) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    // Delete student first (has FK to user), then user
    await db.delete(students).where(eq(students.id, id));
    await db.delete(users).where(eq(users.id, student[0].userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
