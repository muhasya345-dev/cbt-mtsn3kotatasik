import { NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// GET: only admin & guru users (siswa managed via /api/students)
export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      plainPassword: users.plainPassword,
      role: users.role,
      fullName: users.fullName,
      nip: users.nip,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users)
      .where(ne(users.role, "siswa"))
      .orderBy(users.fullName);

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST: create admin or guru user only
export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as {
      username: string;
      password: string;
      role: string;
      fullName: string;
      nip?: string;
    };

    if (!body.username || !body.password || !body.role || !body.fullName) {
      return NextResponse.json({ error: "Field wajib belum lengkap" }, { status: 400 });
    }

    if (body.role !== "admin" && body.role !== "guru") {
      return NextResponse.json({ error: "Akun siswa dibuat melalui menu Data Siswa" }, { status: 400 });
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
      plainPassword: body.password,
      role: body.role,
      fullName: body.fullName,
      nip: body.nip || null,
      isActive: true,
    });

    return NextResponse.json({ success: true, userId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
