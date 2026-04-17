import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { teacherAssignments, users, subjects, classes, examEvents, questions } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const assignmentsRouter = new Hono<Env>();

// GET /api/assignments — admin sees all
assignmentsRouter.get("/", requireRole("admin"), async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: teacherAssignments.id,
      examEventId: teacherAssignments.examEventId,
      examEventName: examEvents.name,
      teacherUserId: teacherAssignments.teacherUserId,
      teacherName: users.fullName,
      subjectId: teacherAssignments.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      classId: teacherAssignments.classId,
      className: classes.name,
      gradeLevel: classes.gradeLevel,
      status: teacherAssignments.status,
      createdAt: teacherAssignments.createdAt,
    })
    .from(teacherAssignments)
    .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
    .innerJoin(users, eq(teacherAssignments.teacherUserId, users.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
    .orderBy(teacherAssignments.createdAt);
  return c.json({ assignments: rows });
});

// GET /api/assignments/my — teacher's own
assignmentsRouter.get("/my", requireRole("guru"), async (c) => {
  const session = c.get("session")!;
  const db = c.get("db");

  const rows = await db
    .select({
      id: teacherAssignments.id,
      examEventName: examEvents.name,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      className: classes.name,
      gradeLevel: classes.gradeLevel,
      status: teacherAssignments.status,
      createdAt: teacherAssignments.createdAt,
    })
    .from(teacherAssignments)
    .innerJoin(examEvents, eq(teacherAssignments.examEventId, examEvents.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(classes, eq(teacherAssignments.classId, classes.id))
    .where(eq(teacherAssignments.teacherUserId, session.id))
    .orderBy(teacherAssignments.createdAt);

  const result = [];
  for (const row of rows) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.assignmentId, row.id));
    result.push({ ...row, questionCount: countResult[0]?.count ?? 0 });
  }

  return c.json({ assignments: result });
});

// POST /api/assignments
assignmentsRouter.post("/", requireRole("admin"), async (c) => {
  const body = await c.req.json<{
    examEventId: string;
    teacherUserId: string;
    subjectId: string;
    classId: string;
  }>();

  if (!body.examEventId || !body.teacherUserId || !body.subjectId || !body.classId) {
    return c.json({ error: "Semua field wajib diisi" }, 400);
  }

  const db = c.get("db");
  const id = createId();
  await db.insert(teacherAssignments).values({
    id,
    examEventId: body.examEventId,
    teacherUserId: body.teacherUserId,
    subjectId: body.subjectId,
    classId: body.classId,
    status: "pending",
  });
  return c.json({ success: true, id }, 201);
});

assignmentsRouter.put("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    examEventId?: string;
    teacherUserId?: string;
    subjectId?: string;
    classId?: string;
    status?: "pending" | "submitted" | "approved";
  }>();
  const db = c.get("db");
  await db.update(teacherAssignments).set(body).where(eq(teacherAssignments.id, id));
  return c.json({ success: true });
});

assignmentsRouter.delete("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(teacherAssignments).where(eq(teacherAssignments.id, id));
  return c.json({ success: true });
});
