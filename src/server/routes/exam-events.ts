import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { examEvents } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const examEventsRouter = new Hono<Env>();
examEventsRouter.use("*", requireRole("admin"));

examEventsRouter.get("/", async (c) => {
  const db = c.get("db");
  const all = await db.select().from(examEvents).orderBy(examEvents.createdAt);
  return c.json({ events: all });
});

examEventsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    semester: "ganjil" | "genap";
    academicYear: string;
    isActive?: boolean;
  }>();

  if (!body.name || !body.semester || !body.academicYear) {
    return c.json({ error: "Semua field wajib diisi" }, 400);
  }

  const db = c.get("db");
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

  return c.json({ success: true, id }, 201);
});

examEventsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    semester?: "ganjil" | "genap";
    academicYear?: string;
    isActive?: boolean;
  }>();
  const db = c.get("db");
  if (body.isActive) {
    await db.update(examEvents).set({ isActive: false });
  }
  await db.update(examEvents).set(body).where(eq(examEvents.id, id));
  return c.json({ success: true });
});

examEventsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(examEvents).where(eq(examEvents.id, id));
  return c.json({ success: true });
});
