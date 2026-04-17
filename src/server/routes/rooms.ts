import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { rooms, examEvents } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const roomsRouter = new Hono<Env>();
roomsRouter.use("*", requireRole("admin"));

roomsRouter.get("/", async (c) => {
  const db = c.get("db");
  const examEventId = c.req.query("examEventId");

  const base = db
    .select({
      id: rooms.id,
      name: rooms.name,
      capacity: rooms.capacity,
      examEventId: rooms.examEventId,
      examEventName: examEvents.name,
    })
    .from(rooms)
    .innerJoin(examEvents, eq(rooms.examEventId, examEvents.id));

  const rows = examEventId
    ? await base.where(eq(rooms.examEventId, examEventId)).orderBy(rooms.name)
    : await base.orderBy(rooms.name);

  return c.json({ rooms: rows });
});

roomsRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; capacity: number; examEventId: string }>();
  if (!body.name || !body.capacity || !body.examEventId) {
    return c.json({ error: "Semua field wajib diisi" }, 400);
  }
  const db = c.get("db");
  const id = createId();
  await db.insert(rooms).values({
    id,
    name: body.name,
    capacity: body.capacity,
    examEventId: body.examEventId,
  });
  return c.json({ success: true, id }, 201);
});

roomsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; capacity?: number }>();
  const db = c.get("db");
  await db.update(rooms).set(body).where(eq(rooms.id, id));
  return c.json({ success: true });
});

roomsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(rooms).where(eq(rooms.id, id));
  return c.json({ success: true });
});
