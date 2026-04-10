import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { questions, teacherAssignments } from "@/db/schema";
import { requireRole } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("admin", "guru");
    const { id } = await params;
    const body = await request.json() as {
      orderNumber?: number;
      type?: "multiple_choice" | "true_false" | "essay";
      content?: string;
      options?: string | null;
      correctAnswer?: string | null;
      points?: number;
    };

    const db = await getDb();

    const question = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    if (!question.length) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    // Guru only can edit their own, admin can edit all
    if (session.role === "guru") {
      const assignment = await db.select().from(teacherAssignments)
        .where(eq(teacherAssignments.id, question[0].assignmentId)).limit(1);
      if (!assignment.length || assignment[0].teacherUserId !== session.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.update(questions).set(body).where(eq(questions.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("admin", "guru");
    const { id } = await params;
    const db = await getDb();

    const question = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    if (!question.length) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    // Guru only can delete their own, admin can delete all
    if (session.role === "guru") {
      const assignment = await db.select().from(teacherAssignments)
        .where(eq(teacherAssignments.id, question[0].assignmentId)).limit(1);
      if (!assignment.length || assignment[0].teacherUserId !== session.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.delete(questions).where(eq(questions.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
