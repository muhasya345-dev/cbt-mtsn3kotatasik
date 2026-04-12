import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { examEvents } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();
    const all = await db.select().from(examEvents).orderBy(examEvents.createdAt);
    return NextResponse.json({ events: all });
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
      name: string;
      semester: "ganjil" | "genap";
      academicYear: string;
      isActive?: boolean;
    };

    if (!body.name || !body.semester || !body.academicYear) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const db = await getDb();

    // If setting as active, deactivate all others
    if (body.isActive) {
      await db.update(examEvents).set({ isActive: false });
    }

    const id = createId();
    await db.insert(examEvents).values({
      id,
      name: body.name,
      semester: body.semester,
      academicYear: body.academicYear,
      isActive: body.isActive ?? false,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
