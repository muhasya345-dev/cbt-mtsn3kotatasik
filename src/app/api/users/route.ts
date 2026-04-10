import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, students } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();
    const allUsers = await db.select().from(users).orderBy(users.fullName);
    return NextResponse.json({ users: allUsers.map(({ passwordHash, ...u }) => u) });
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
      username: string;
      password: string;
      role: "admin" | "guru" | "siswa";
      fullName: string;
      nip?: string;
      nis?: string;
      nisn?: string;
      classId?: string;
      gender?: "L" | "P";
    };

    if (!body.username || !body.password || !body.role || !body.fullName) {
      return NextResponse.json({ error: "Field wajib belum lengkap" }, { status: 400 });
    }

    const db = await getDb();

    // Check duplicate username
    const existing = await db.select().from(users).where(eq(users.username, body.username)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
    }

    const userId = createId();
    const passwordHash = await hashPassword(body.password);

    await db.insert(users).values({
      id: userId,
      username: body.username,
      passwordHash,
      role: body.role,
      fullName: body.fullName,
      nip: body.nip || null,
      isActive: true,
    });

    // If siswa, create student record
    if (body.role === "siswa" && body.classId) {
      await db.insert(students).values({
        id: createId(),
        userId,
        nis: body.nis || body.username,
        nisn: body.nisn || null,
        classId: body.classId,
        gender: body.gender || "L",
      });
    }

    return NextResponse.json({ success: true, userId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
