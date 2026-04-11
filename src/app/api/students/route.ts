import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { students, users, classes } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// Generate random string with uppercase letters and digits
function generateRandom(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

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
        plainPassword: users.plainPassword,
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

// POST: create student with auto-generated username & password
export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as {
      fullName: string;
      nis: string;
      nisn?: string;
      classId: string;
      gender: "L" | "P";
      birthPlace?: string;
      birthDate?: string;
    };

    if (!body.fullName || !body.nis || !body.classId || !body.gender) {
      return NextResponse.json({ error: "Nama, NIS, Kelas, dan Jenis Kelamin wajib diisi" }, { status: 400 });
    }

    const db = await getDb();

    // Check duplicate NIS
    const existingNis = await db.select().from(students).where(eq(students.nis, body.nis)).limit(1);
    if (existingNis.length > 0) {
      return NextResponse.json({ error: `NIS ${body.nis} sudah terdaftar` }, { status: 409 });
    }

    // Auto-generate username (12 chars) and password (8 chars)
    let username = generateRandom(12);
    // Ensure unique username
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length === 0) break;
      username = generateRandom(12);
      attempts++;
    }

    const plainPassword = generateRandom(8);
    const passwordHash = await hashPassword(plainPassword);

    const userId = createId();
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash,
      plainPassword,
      role: "siswa",
      fullName: body.fullName,
      isActive: true,
    });

    const studentId = createId();
    await db.insert(students).values({
      id: studentId,
      userId,
      nis: body.nis,
      nisn: body.nisn || null,
      classId: body.classId,
      gender: body.gender,
      birthPlace: body.birthPlace || null,
      birthDate: body.birthDate || null,
    });

    return NextResponse.json({
      success: true,
      studentId,
      username,
      password: plainPassword,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
