import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import {
  rooms,
  examEvents,
  roomAssignments,
  students,
  users,
  classes,
} from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { requireRole } from "../auth";
import type { Env } from "../context";
import {
  computePlacement,
  type PlacementRoom,
  type PlacementStudent,
} from "@/lib/placement-algorithm";

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
      tableCapacity: rooms.tableCapacity,
      mixGrades: rooms.mixGrades,
      sortMode: rooms.sortMode,
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
  const body = await c.req.json<{
    name: string;
    capacity: number;
    examEventId: string;
    tableCapacity?: number;
    mixGrades?: boolean;
    sortMode?: "class-order" | "shuffle";
  }>();
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
    tableCapacity: body.tableCapacity ?? 2,
    mixGrades: body.mixGrades ?? true,
    sortMode: body.sortMode ?? "class-order",
  });
  return c.json({ success: true, id }, 201);
});

roomsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    capacity?: number;
    tableCapacity?: number;
    mixGrades?: boolean;
    sortMode?: "class-order" | "shuffle";
  }>();
  const db = c.get("db");
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.capacity !== undefined) patch.capacity = body.capacity;
  if (body.tableCapacity !== undefined) patch.tableCapacity = body.tableCapacity;
  if (body.mixGrades !== undefined) patch.mixGrades = body.mixGrades;
  if (body.sortMode !== undefined) patch.sortMode = body.sortMode;
  await db.update(rooms).set(patch).where(eq(rooms.id, id));
  return c.json({ success: true });
});

roomsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(rooms).where(eq(rooms.id, id));
  return c.json({ success: true });
});

/**
 * Bulk update rules untuk semua ruangan di sebuah event (praktis dari dialog pengaturan).
 */
roomsRouter.put("/bulk/rules", async (c) => {
  const body = await c.req.json<{
    examEventId: string;
    tableCapacity?: number;
    mixGrades?: boolean;
    sortMode?: "class-order" | "shuffle";
  }>();
  if (!body.examEventId) return c.json({ error: "examEventId diperlukan" }, 400);
  const db = c.get("db");
  const patch: Record<string, unknown> = {};
  if (body.tableCapacity !== undefined) patch.tableCapacity = body.tableCapacity;
  if (body.mixGrades !== undefined) patch.mixGrades = body.mixGrades;
  if (body.sortMode !== undefined) patch.sortMode = body.sortMode;
  if (Object.keys(patch).length === 0) return c.json({ success: true });
  await db.update(rooms).set(patch).where(eq(rooms.examEventId, body.examEventId));
  return c.json({ success: true });
});

/**
 * Generate penempatan duduk untuk seluruh ruangan di sebuah event ujian.
 * - Baca participating_class_ids dari event (atau semua kelas jika null).
 * - Baca semua siswa dari kelas tsb.
 * - Jalankan algoritma; hasilkan seat + participant number.
 * - REPLACE semua roomAssignments untuk event ini (delete lalu insert).
 */
roomsRouter.post("/generate-placement", async (c) => {
  const body = await c.req.json<{ examEventId: string }>();
  const examEventId = body.examEventId;
  if (!examEventId) return c.json({ error: "examEventId diperlukan" }, 400);

  const db = c.get("db");
  const evRows = await db.select().from(examEvents).where(eq(examEvents.id, examEventId)).limit(1);
  if (!evRows.length) return c.json({ error: "Event tidak ditemukan" }, 404);
  const ev = evRows[0];

  const eventRooms = await db.select().from(rooms).where(eq(rooms.examEventId, examEventId));
  if (!eventRooms.length) {
    return c.json({ error: "Belum ada ruangan untuk event ini" }, 400);
  }

  // Filter kelas
  let classIds: string[] | null = null;
  if (ev.participatingClassIds) {
    try {
      const parsed = JSON.parse(ev.participatingClassIds) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) classIds = parsed;
    } catch {
      classIds = null;
    }
  }

  // Ambil siswa
  const studentsQuery = db
    .select({
      id: students.id,
      nis: students.nis,
      classId: students.classId,
      className: classes.name,
      gradeLevel: classes.gradeLevel,
      fullName: users.fullName,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(users, eq(students.userId, users.id));

  const studentRows = classIds
    ? await studentsQuery.where(inArray(students.classId, classIds))
    : await studentsQuery;

  if (!studentRows.length) {
    return c.json({ error: "Tidak ada siswa eligible untuk event ini" }, 400);
  }

  const placementStudents: PlacementStudent[] = studentRows.map((s) => ({
    id: s.id,
    nis: s.nis,
    classId: s.classId,
    className: s.className,
    gradeLevel: s.gradeLevel,
    fullName: s.fullName,
  }));

  // Ambil rule dari ruangan pertama (sort-mode diasumsikan sama semua ruang)
  const sortMode = (eventRooms[0].sortMode ?? "class-order") as "class-order" | "shuffle";

  const placementRooms: PlacementRoom[] = eventRooms.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    tableCapacity: r.tableCapacity ?? 2,
    mixGrades: r.mixGrades ?? true,
  }));

  const { results, unplaced, warnings } = computePlacement(placementStudents, placementRooms, {
    sortMode,
    academicYear: ev.academicYear,
  });

  // Replace semua assignments untuk ruangan-ruangan ini
  const roomIds = eventRooms.map((r) => r.id);
  await db.delete(roomAssignments).where(inArray(roomAssignments.roomId, roomIds));

  if (results.length > 0) {
    // D1 punya batas parameter per query — insert per-chunk
    const CHUNK = 50;
    for (let i = 0; i < results.length; i += CHUNK) {
      const chunk = results.slice(i, i + CHUNK).map((r) => ({
        id: createId(),
        roomId: r.roomId,
        studentId: r.studentId,
        seatNumber: r.seatNumber,
        participantNumber: r.participantNumber,
      }));
      await db.insert(roomAssignments).values(chunk);
    }
  }

  return c.json({
    success: true,
    placed: results.length,
    unplaced: unplaced.length,
    warnings,
    totalStudents: studentRows.length,
    totalRooms: eventRooms.length,
  });
});

/**
 * Reset (hapus) semua penempatan untuk sebuah event.
 */
roomsRouter.post("/reset-placement", async (c) => {
  const body = await c.req.json<{ examEventId: string }>();
  const examEventId = body.examEventId;
  if (!examEventId) return c.json({ error: "examEventId diperlukan" }, 400);
  const db = c.get("db");
  const eventRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.examEventId, examEventId));
  const ids = eventRooms.map((r) => r.id);
  if (ids.length === 0) return c.json({ success: true });
  await db.delete(roomAssignments).where(inArray(roomAssignments.roomId, ids));
  return c.json({ success: true });
});
