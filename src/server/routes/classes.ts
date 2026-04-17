import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { classes } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const classesRouter = new Hono<Env>();

classesRouter.get("/", requireRole("admin", "guru"), async (c) => {
  const db = c.get("db");
  const all = await db.select().from(classes).orderBy(classes.gradeLevel, classes.name);
  return c.json({ classes: all });
});

classesRouter.post("/", requireRole("admin"), async (c) => {
  const body = await c.req.json<{ name: string; gradeLevel: number; academicYear: string }>();
  if (!body.name || !body.gradeLevel || !body.academicYear) {
    return c.json({ error: "Semua field wajib diisi" }, 400);
  }
  const db = c.get("db");
  const id = createId();
  await db.insert(classes).values({
    id,
    name: body.name,
    gradeLevel: body.gradeLevel,
    academicYear: body.academicYear,
  });
  return c.json({ success: true, id }, 201);
});

classesRouter.put("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; gradeLevel?: number; academicYear?: string }>();
  const db = c.get("db");
  await db.update(classes).set(body).where(eq(classes.id, id));
  return c.json({ success: true });
});

classesRouter.delete("/:id", requireRole("admin"), async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(classes).where(eq(classes.id, id));
  return c.json({ success: true });
});
