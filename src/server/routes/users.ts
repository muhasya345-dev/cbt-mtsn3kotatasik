import { Hono } from "hono";
import { eq, ne } from "drizzle-orm";
import { users, students } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import * as XLSX from "xlsx";
import { hashPassword } from "../password";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const usersRouter = new Hono<Env>();

// All routes require admin
usersRouter.use("*", requireRole("admin"));

// GET /api/users — admin & guru only (siswa managed via /api/students)
usersRouter.get("/", async (c) => {
  const db = c.get("db");
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      plainPassword: users.plainPassword,
      role: users.role,
      fullName: users.fullName,
      nip: users.nip,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(ne(users.role, "siswa"))
    .orderBy(users.fullName);
  return c.json({ users: allUsers });
});

// POST /api/users — create admin or guru
usersRouter.post("/", async (c) => {
  const body = await c.req.json<{
    username: string;
    password: string;
    role: string;
    fullName: string;
    nip?: string;
  }>();

  if (!body.username || !body.password || !body.role || !body.fullName) {
    return c.json({ error: "Field wajib belum lengkap" }, 400);
  }

  if (body.role !== "admin" && body.role !== "guru") {
    return c.json({ error: "Akun siswa dibuat melalui menu Data Siswa" }, 400);
  }

  const db = c.get("db");

  const existing = await db.select().from(users).where(eq(users.username, body.username)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Username sudah digunakan" }, 409);
  }

  const userId = createId();
  const passwordHash = await hashPassword(body.password);

  await db.insert(users).values({
    id: userId,
    username: body.username,
    passwordHash,
    plainPassword: body.password,
    role: body.role,
    fullName: body.fullName,
    nip: body.nip || null,
    isActive: true,
  });

  return c.json({ success: true, userId }, 201);
});

// GET /api/users/:id
usersRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (result.length === 0) {
    return c.json({ error: "User tidak ditemukan" }, 404);
  }
  const { passwordHash: _pw, ...user } = result[0];
  void _pw;
  return c.json({ user });
});

// PUT /api/users/:id
usersRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    fullName?: string;
    username?: string;
    password?: string;
    role?: "admin" | "guru" | "siswa";
    nip?: string;
    isActive?: boolean;
  }>();

  const db = c.get("db");
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.fullName) updateData.fullName = body.fullName;
  if (body.username) updateData.username = body.username;
  if (body.role) updateData.role = body.role;
  if (body.nip !== undefined) updateData.nip = body.nip;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.password) {
    updateData.passwordHash = await hashPassword(body.password);
    updateData.plainPassword = body.password;
  }

  await db.update(users).set(updateData).where(eq(users.id, id));
  return c.json({ success: true });
});

// DELETE /api/users/:id
usersRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  await db.delete(users).where(eq(users.id, id));
  return c.json({ success: true });
});

// POST /api/users/import
usersRouter.post("/import", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const role = formData.get("role") as string | null;

    if (!file || !role) {
      return c.json({ error: "File dan role wajib diisi" }, 400);
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      return c.json({ error: "File Excel kosong" }, 400);
    }

    const db = c.get("db");
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const username = String(row["Username"] || row["NIP"] || row["NIS"] || "").trim();
      const fullName = String(row["Nama Lengkap"] || row["Nama"] || "").trim();
      const password = String(row["Password"] || username).trim();

      if (!username || !fullName) {
        errors.push(`Baris ${rowNum}: Username atau Nama kosong`);
        skipped++;
        continue;
      }

      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length > 0) {
        errors.push(`Baris ${rowNum}: Username "${username}" sudah ada`);
        skipped++;
        continue;
      }

      const userId = createId();
      const passwordHash = await hashPassword(password);

      await db.insert(users).values({
        id: userId,
        username,
        passwordHash,
        role: role as "admin" | "guru" | "siswa",
        fullName,
        nip: role === "guru" ? username : null,
        isActive: true,
      });

      if (role === "siswa") {
        const classId = String(row["Kelas ID"] || row["Class ID"] || "").trim();
        const nis = String(row["NIS"] || username).trim();
        const nisn = String(row["NISN"] || "").trim();
        const gender = String(row["Jenis Kelamin"] || row["Gender"] || "L").trim().toUpperCase();

        if (classId) {
          await db.insert(students).values({
            id: createId(),
            userId,
            nis,
            nisn: nisn || null,
            classId,
            gender: gender === "P" ? "P" : "L",
          });
        }
      }

      imported++;
    }

    return c.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Import error:", error);
    return c.json({ error: "Gagal import data" }, 500);
  }
});

// GET /api/users/export
usersRouter.get("/export", async (c) => {
  const db = c.get("db");

  const data = await db
    .select({
      username: users.username,
      plainPassword: users.plainPassword,
      fullName: users.fullName,
      role: users.role,
      nip: users.nip,
      isActive: users.isActive,
    })
    .from(users)
    .where(ne(users.role, "siswa"))
    .orderBy(users.fullName);

  const exportData = data.map((u) => ({
    Username: u.username,
    Password: u.plainPassword || "",
    "Nama Lengkap": u.fullName,
    Role: u.role,
    NIP: u.nip || "",
    Status: u.isActive ? "Aktif" : "Nonaktif",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(exportData);
  sheet["!cols"] = [
    { wch: 22 }, { wch: 20 }, { wch: 35 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Admin & Guru");
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="users-admin-guru.xlsx"`,
    },
  });
});
