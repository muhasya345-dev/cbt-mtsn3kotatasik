import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subjects } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin", "guru");
    const db = await getDb();
    const all = await db.select().from(subjects).orderBy(subjects.name);
    return NextResponse.json({ subjects: all });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as { name: string; code: string };

    if (!body.name || !body.code) {
      return NextResponse.json({ error: "Nama dan kode wajib diisi" }, { status: 400 });
    }

    const db = await getDb();

    // Check duplicate code
    const existing = await db.select().from(subjects).where(eq(subjects.code, body.code)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Kode mata pelajaran sudah ada" }, { status: 409 });
    }

    const id = createId();
    await db.insert(subjects).values({ id, name: body.name, code: body.code });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
