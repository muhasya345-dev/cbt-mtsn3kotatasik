import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { subjects } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const subjectsRouter = new Hono<Env>();

subjectsRouter.get("/", requireRole("admin", "guru"), async (c) => {
  const db = c.get("db");
  const all = await db.select().from(subjects).orderBy(subjects.name);
  return c.json({ subjects: all });
});

subjectsRouter.post("/", requireRole("admin"), async (c) => {
  const body = await c.req.json<{ name: string; code: string }>();
  if (!body.name || !body.code) {
    return c.json({ error: "Nama dan kode wajib diisi" }, 400);
  }
  const db = c.get("db");
  const existing = await db.select().from(subjects).where(eq(subjects.code, body.code)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Kode mata pelajaran sudah ada" }, 409);
  }
  const id = createId();
  await db.insert(subjects).values({ id, name: body.name, code: body.code });
  return c.json({ success: true, id }, 201);
});

subjectsRouter.put("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; code?: string }>();
  const db = c.get("db");
  await db.update(subjects).set(body).where(eq(subjects.id, id));
  return c.json({ success: true });
});

subjectsRouter.delete("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(subjects).where(eq(subjects.id, id));
  return c.json({ success: true });
});
