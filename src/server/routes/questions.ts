import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { questions, teacherAssignments } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const questionsRouter = new Hono<Env>();
questionsRouter.use("*", requireRole("admin", "guru"));

questionsRouter.get("/", async (c) => {
  const session = c.get("session")!;
  const assignmentId = c.req.query("assignmentId");

  if (!assignmentId) {
    return c.json({ error: "assignmentId diperlukan" }, 400);
  }

  const db = c.get("db");

  if (session.role === "guru") {
    const assignment = await db.select().from(teacherAssignments)
      .where(eq(teacherAssignments.id, assignmentId)).limit(1);
    if (!assignment.length || assignment[0].teacherUserId !== session.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const rows = await db.select().from(questions)
    .where(eq(questions.assignmentId, assignmentId))
    .orderBy(questions.orderNumber);

  return c.json({ questions: rows });
});

questionsRouter.post("/", async (c) => {
  const session = c.get("session")!;
  const body = await c.req.json<{
    assignmentId: string;
    orderNumber: number;
    type: "multiple_choice" | "true_false" | "essay";
    content: string;
    options?: string;
    correctAnswer?: string;
    points?: number;
  }>();

  if (!body.assignmentId || !body.type || !body.content) {
    return c.json({ error: "Field wajib belum lengkap" }, 400);
  }

  const db = c.get("db");
  const assignment = await db.select().from(teacherAssignments)
    .where(eq(teacherAssignments.id, body.assignmentId)).limit(1);
  if (!assignment.length) {
    return c.json({ error: "Penugasan tidak ditemukan" }, 404);
  }
  if (session.role === "guru" && assignment[0].teacherUserId !== session.id) {
    return c.json({ error: "Forbidden" }, 403);
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

  return c.json({ success: true, id }, 201);
});

questionsRouter.put("/:id", async (c) => {
  const session = c.get("session")!;
  const id = c.req.param("id");
  const body = await c.req.json<{
    orderNumber?: number;
    type?: "multiple_choice" | "true_false" | "essay";
    content?: string;
    options?: string | null;
    correctAnswer?: string | null;
    points?: number;
  }>();

  const db = c.get("db");
  const question = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!question.length) return c.json({ error: "Soal tidak ditemukan" }, 404);

  if (session.role === "guru") {
    const assignment = await db.select().from(teacherAssignments)
      .where(eq(teacherAssignments.id, question[0].assignmentId)).limit(1);
    if (!assignment.length || assignment[0].teacherUserId !== session.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await db.update(questions).set(body).where(eq(questions.id, id));
  return c.json({ success: true });
});

questionsRouter.delete("/:id", async (c) => {
  const session = c.get("session")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const question = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!question.length) return c.json({ error: "Soal tidak ditemukan" }, 404);

  if (session.role === "guru") {
    const assignment = await db.select().from(teacherAssignments)
      .where(eq(teacherAssignments.id, question[0].assignmentId)).limit(1);
    if (!assignment.length || assignment[0].teacherUserId !== session.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await db.delete(questions).where(eq(questions.id, id));
  return c.json({ success: true });
});
