import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { students, users, classes } from "@/db/schema";
import { createId } from "@paralleldrive/cuid2";
import * as XLSX from "xlsx";
import { hashPassword } from "../password";
import { requireRole } from "../auth";
import type { Env } from "../context";

export const studentsRouter = new Hono<Env>();
studentsRouter.use("*", requireRole("admin"));

function generateRandom(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

studentsRouter.get("/", async (c) => {
  const db = c.get("db");
  const result = await db
    .select({
      id: students.id,
      userId: students.userId,
      nis: students.nis,
      nisn: students.nisn,
      fullName: users.fullName,
      username: users.username,
      plainPassword: users.plainPassword,
      gender: students.gender,
      birthPlace: students.birthPlace,
      birthDate: students.birthDate,
      classId: students.classId,
      className: classes.name,
      isActive: users.isActive,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .orderBy(classes.name, users.fullName);
  return c.json({ students: result });
});

studentsRouter.post("/", async (c) => {
  const body = await c.req.json<{
    fullName: string;
    nis: string;
    nisn?: string;
    classId: string;
    gender: "L" | "P";
    birthPlace?: string;
    birthDate?: string;
  }>();

  if (!body.fullName || !body.nis || !body.classId || !body.gender) {
    return c.json({ error: "Nama, NIS, Kelas, dan Jenis Kelamin wajib diisi" }, 400);
  }

  const db = c.get("db");
  const existingNis = await db.select().from(students).where(eq(students.nis, body.nis)).limit(1);
  if (existingNis.length > 0) {
    return c.json({ error: `NIS ${body.nis} sudah terdaftar` }, 409);
  }

  let username = generateRandom(12);
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length === 0) break;
    username = generateRandom(12);
    attempts++;
  }

  const plainPassword = generateRandom(8);
  const passwordHash = await hashPassword(plainPassword);
  const userId = createId();
  await db.insert(users).values({
    id: userId,
    username,
    passwordHash,
    plainPassword,
    role: "siswa",
    fullName: body.fullName,
    isActive: true,
  });

  const studentId = createId();
  await db.insert(students).values({
    id: studentId,
    userId,
    nis: body.nis,
    nisn: body.nisn || null,
    classId: body.classId,
    gender: body.gender,
    birthPlace: body.birthPlace || null,
    birthDate: body.birthDate || null,
  });

  return c.json({ success: true, studentId, username, password: plainPassword }, 201);
});

studentsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    fullName?: string;
    nis?: string;
    nisn?: string;
    classId?: string;
    gender?: "L" | "P";
    birthPlace?: string;
    birthDate?: string;
    isActive?: boolean;
    password?: string;
  }>();

  const db = c.get("db");
  const student = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!student.length) return c.json({ error: "Siswa tidak ditemukan" }, 404);

  const userUpdate: Record<string, unknown> = { updatedAt: new Date() };
  if (body.fullName) userUpdate.fullName = body.fullName;
  if (body.isActive !== undefined) userUpdate.isActive = body.isActive;
  if (body.password) {
    userUpdate.passwordHash = await hashPassword(body.password);
    userUpdate.plainPassword = body.password;
  }
  await db.update(users).set(userUpdate).where(eq(users.id, student[0].userId));

  const studentUpdate: Record<string, unknown> = {};
  if (body.nis) studentUpdate.nis = body.nis;
  if (body.nisn !== undefined) studentUpdate.nisn = body.nisn || null;
  if (body.classId) studentUpdate.classId = body.classId;
  if (body.gender) studentUpdate.gender = body.gender;
  if (body.birthPlace !== undefined) studentUpdate.birthPlace = body.birthPlace || null;
  if (body.birthDate !== undefined) studentUpdate.birthDate = body.birthDate || null;

  if (Object.keys(studentUpdate).length > 0) {
    await db.update(students).set(studentUpdate).where(eq(students.id, id));
  }

  return c.json({ success: true });
});

studentsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const student = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!student.length) return c.json({ error: "Siswa tidak ditemukan" }, 404);
  await db.delete(students).where(eq(students.id, id));
  await db.delete(users).where(eq(users.id, student[0].userId));
  return c.json({ success: true });
});

studentsRouter.post("/import", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "File diperlukan" }, 400);

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];

  const db = c.get("db");
  const allClasses = await db.select().from(classes);
  const classMap = new Map(allClasses.map((cl) => [cl.name.toLowerCase(), cl.id]));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const fullName = (row["Nama Lengkap"] || row["Nama"] || "").toString().trim();
    const nis = (row["NIS"] || "").toString().trim();
    const nisn = (row["NISN"] || "").toString().trim();
    const className = (row["Kelas"] || "").toString().trim();
    const gender = (row["Jenis Kelamin (L/P)"] || row["L/P"] || row["Gender"] || "L").toString().trim().toUpperCase();
    const birthPlace = (row["Tempat Lahir"] || "").toString().trim();
    const birthDate = (row["Tanggal Lahir (YYYY-MM-DD)"] || row["Tanggal Lahir"] || "").toString().trim();

    if (!fullName || !nis) { skipped++; continue; }
    if (fullName.toLowerCase().startsWith("contoh")) { skipped++; continue; }

    const existingNis = await db.select().from(students).where(eq(students.nis, nis)).limit(1);
    if (existingNis.length > 0) {
      errors.push(`NIS ${nis} (${fullName}) sudah terdaftar, dilewati`);
      skipped++;
      continue;
    }

    const classId = classMap.get(className.toLowerCase());
    if (!classId) {
      errors.push(`Kelas "${className}" tidak ditemukan untuk ${fullName}, dilewati`);
      skipped++;
      continue;
    }

    let username = generateRandom(12);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length === 0) break;
      username = generateRandom(12);
      attempts++;
    }

    const plainPassword = generateRandom(8);
    const pwdHash = await hashPassword(plainPassword);
    const userId = createId();
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash: pwdHash,
      plainPassword,
      role: "siswa",
      fullName,
      isActive: true,
    });

    await db.insert(students).values({
      id: createId(),
      userId,
      nis,
      nisn: nisn || null,
      classId,
      gender: (gender === "P" ? "P" : "L") as "L" | "P",
      birthPlace: birthPlace || null,
      birthDate: birthDate || null,
    });

    imported++;
  }

  return c.json({ imported, skipped, errors });
});

studentsRouter.get("/export", async (c) => {
  const db = c.get("db");
  const mode = c.req.query("mode");

  if (mode === "template") {
    const templateData = [
      {
        "Nama Lengkap": "Contoh: Ahmad Fauzan",
        "NIS": "Contoh: 12345",
        "NISN": "Contoh: 0012345678",
        "Kelas": "Contoh: 7A",
        "Jenis Kelamin (L/P)": "Contoh: L",
        "Tempat Lahir": "Contoh: Tasikmalaya",
        "Tanggal Lahir (YYYY-MM-DD)": "Contoh: 2012-05-15",
      },
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(templateData);
    sheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Template Siswa");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template-import-siswa.xlsx"`,
      },
    });
  }

  const result = await db
    .select({
      nis: students.nis,
      nisn: students.nisn,
      fullName: users.fullName,
      username: users.username,
      plainPassword: users.plainPassword,
      className: classes.name,
      gender: students.gender,
      birthPlace: students.birthPlace,
      birthDate: students.birthDate,
      isActive: users.isActive,
    })
    .from(students)
    .innerJoin(users, eq(students.userId, users.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .orderBy(classes.name, users.fullName);

  const exportData = result.map((s) => ({
    NIS: s.nis,
    NISN: s.nisn || "",
    "Nama Lengkap": s.fullName,
    Kelas: s.className,
    "L/P": s.gender,
    Username: s.username,
    Password: s.plainPassword || "",
    "Tempat Lahir": s.birthPlace || "",
    "Tanggal Lahir": s.birthDate || "",
    Status: s.isActive ? "Aktif" : "Nonaktif",
  }));

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(exportData);
  sheet["!cols"] = [
    { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 5 },
    { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Data Siswa");
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="data-siswa.xlsx"`,
    },
  });
});
