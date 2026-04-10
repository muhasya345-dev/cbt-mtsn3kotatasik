import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { questions, teacherAssignments } from "@/db/schema";
import { requireRole, getSession } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";

// GET questions by assignmentId (query param)
export async function GET(request: Request) {
  try {
    const session = await requireRole("admin", "guru");
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId diperlukan" }, { status: 400 });
    }

    const db = await getDb();

    // Guru can only access their own assignments
    if (session.role === "guru") {
      const assignment = await db.select().from(teacherAssignments)
        .where(eq(teacherAssignments.id, assignmentId)).limit(1);
      if (!assignment.length || assignment[0].teacherUserId !== session.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const rows = await db.select().from(questions)
      .where(eq(questions.assignmentId, assignmentId))
      .orderBy(questions.orderNumber);

    return NextResponse.json({ questions: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole("admin", "guru");
    const body = await request.json() as {
      assignmentId: string;
      orderNumber: number;
      type: "multiple_choice" | "true_false" | "essay";
      content: string;
      options?: string;
      correctAnswer?: string;
      points?: number;
    };

    if (!body.assignmentId || !body.type || !body.content) {
      return NextResponse.json({ error: "Field wajib belum lengkap" }, { status: 400 });
    }

    const db = await getDb();

    // Verify ownership: admin can access all, guru only their own
    const assignment = await db.select().from(teacherAssignments)
      .where(eq(teacherAssignments.id, body.assignmentId)).limit(1);
    if (!assignment.length) {
      return NextResponse.json({ error: "Penugasan tidak ditemukan" }, { status: 404 });
    }
    if (session.role === "guru" && assignment[0].teacherUserId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = createId();
    await db.insert(questions).values({
      id,
      assignmentId: body.assignmentId,
      orderNumber: body.orderNumber || 1,
      type: body.type,
      content: body.content,
      options: body.options || null,
      correctAnswer: body.correctAnswer || null,
      points: body.points || 1,
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
