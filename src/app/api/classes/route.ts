import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

export async function GET() {
  try {
    await requireRole("admin", "guru");
    const db = await getDb();
    const allClasses = await db.select().from(classes).orderBy(classes.gradeLevel, classes.name);
    return NextResponse.json({ classes: allClasses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const body = await request.json() as { name: string; gradeLevel: number; academicYear: string };

    if (!body.name || !body.gradeLevel || !body.academicYear) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    const db = await getDb();
    const id = createId();
    await db.insert(classes).values({
      id,
      name: body.name,
      gradeLevel: body.gradeLevel,
      academicYear: body.academicYear,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
