import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { students, users, classes } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import * as XLSX from "xlsx";

function generateRandom(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File diperlukan" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];

    const db = await getDb();

    // Get all classes for mapping
    const allClasses = await db.select().from(classes);
    const classMap = new Map(allClasses.map((c) => [c.name.toLowerCase(), c.id]));

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

      if (!fullName || !nis) {
        skipped++;
        continue;
      }

      // Skip example row
      if (fullName.toLowerCase().startsWith("contoh")) {
        skipped++;
        continue;
      }

      // Check duplicate NIS
      const existingNis = await db.select().from(students).where(eq(students.nis, nis)).limit(1);
      if (existingNis.length > 0) {
        errors.push(`NIS ${nis} (${fullName}) sudah terdaftar, dilewati`);
        skipped++;
        continue;
      }

      // Find class
      const classId = classMap.get(className.toLowerCase());
      if (!classId) {
        errors.push(`Kelas "${className}" tidak ditemukan untuk ${fullName}, dilewati`);
        skipped++;
        continue;
      }

      // Auto-generate username (12 chars) and password (8 chars)
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

    return NextResponse.json({ imported, skipped, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
