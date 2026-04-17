import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { schedules, examEvents, subjects, classes, users } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const schedulesRouter = new Hono<Env>();
schedulesRouter.use("*", requireRole("admin"));

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

schedulesRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: schedules.id,
      examEventId: schedules.examEventId,
      examEventName: examEvents.name,
      subjectId: schedules.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      classId: schedules.classId,
      className: classes.name,
      date: schedules.date,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
      durationMinutes: schedules.durationMinutes,
      proctorUserId: schedules.proctorUserId,
      proctorName: users.fullName,
      token: schedules.token,
      isActive: schedules.isActive,
    })
    .from(schedules)
    .innerJoin(examEvents, eq(schedules.examEventId, examEvents.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .leftJoin(users, eq(schedules.proctorUserId, users.id))
    .orderBy(schedules.date, schedules.startTime);
  return c.json({ schedules: rows });
});

schedulesRouter.post("/", async (c) => {
  const body = await c.req.json<{
    examEventId: string;
    subjectId: string;
    classId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    proctorUserId?: string;
  }>();

  if (!body.examEventId || !body.subjectId || !body.classId || !body.date || !body.startTime || !body.durationMinutes) {
    return c.json({ error: "Semua field wajib diisi" }, 400);
  }

  const [h, m] = body.startTime.split(":").map(Number);
  const totalMin = h * 60 + m + body.durationMinutes;
  const endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;

  const db = c.get("db");
  const id = createId();
  await db.insert(schedules).values({
    id,
    examEventId: body.examEventId,
    subjectId: body.subjectId,
    classId: body.classId,
    date: body.date,
    startTime: body.startTime,
    endTime,
    durationMinutes: body.durationMinutes,
    proctorUserId: body.proctorUserId || null,
    token: generateToken(),
    isActive: false,
  });
  return c.json({ success: true, id }, 201);
});

schedulesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    proctorUserId?: string | null;
    isActive?: boolean;
    token?: string;
  }>();

  const db = c.get("db");
  const updates: Record<string, unknown> = { ...body };
  if (body.startTime && body.durationMinutes) {
    const [h, m] = body.startTime.split(":").map(Number);
    const totalMin = h * 60 + m + body.durationMinutes;
    updates.endTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  }
  await db.update(schedules).set(updates).where(eq(schedules.id, id));
  return c.json({ success: true });
});

schedulesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(schedules).where(eq(schedules.id, id));
  return c.json({ success: true });
});

schedulesRouter.post("/regenerate-token", async (c) => {
  const body = await c.req.json<{ scheduleId: string }>();
  if (!body.scheduleId) return c.json({ error: "scheduleId wajib" }, 400);

  const db = c.get("db");
  const newToken = generateToken();
  await db.update(schedules).set({ token: newToken }).where(eq(schedules.id, body.scheduleId));
  return c.json({ success: true, token: newToken });
});
