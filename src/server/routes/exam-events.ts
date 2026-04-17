import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { examEvents } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const examEventsRouter = new Hono<Env>();
examEventsRouter.use("*", requireRole("admin"));

type SemesterValue = "ganjil" | "genap" | "none";

function normalizeClassIds(input: unknown): string | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const clean = input.filter((v): v is string => typeof v === "string" && v.length > 0);
    if (clean.length === 0) return null;
    return JSON.stringify(clean);
  }
  if (typeof input === "string") return input;
  return null;
}

examEventsRouter.get("/", async (c) => {
  const db = c.get("db");
  const all = await db.select().from(examEvents).orderBy(examEvents.createdAt);
  const events = all.map((ev) => ({
    ...ev,
    participatingClassIds: ev.participatingClassIds
      ? (JSON.parse(ev.participatingClassIds) as string[])
      : null,
  }));
  return c.json({ events });
});

examEventsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    semester: SemesterValue;
    academicYear: string;
    isActive?: boolean;
    participatingClassIds?: string[] | null;
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
    participatingClassIds: normalizeClassIds(body.participatingClassIds),
    isActive: body.isActive ?? false,
  });

  return c.json({ success: true, id }, 201);
});

examEventsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    semester?: SemesterValue;
    academicYear?: string;
    isActive?: boolean;
    participatingClassIds?: string[] | null;
  }>();
  const db = c.get("db");
  if (body.isActive) {
    await db.update(examEvents).set({ isActive: false });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.semester !== undefined) patch.semester = body.semester;
  if (body.academicYear !== undefined) patch.academicYear = body.academicYear;
  if (body.isActive !== undefined) patch.isActive = body.isActive;
  if (body.participatingClassIds !== undefined) {
    patch.participatingClassIds = normalizeClassIds(body.participatingClassIds);
  }

  await db.update(examEvents).set(patch).where(eq(examEvents.id, id));
  return c.json({ success: true });
});

examEventsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(examEvents).where(eq(examEvents.id, id));
  return c.json({ success: true });
});
