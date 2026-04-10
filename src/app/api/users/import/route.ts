import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, students } from "@/db/schema";
import { requireRole, hashPassword } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    await requireRole("admin");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const role = formData.get("role") as string;

    if (!file || !role) {
      return NextResponse.json({ error: "File dan role wajib diisi" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: "File Excel kosong" }, { status: 400 });
    }

    const db = await getDb();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (header = row 1)

      const username = String(row["Username"] || row["NIP"] || row["NIS"] || "").trim();
      const fullName = String(row["Nama Lengkap"] || row["Nama"] || "").trim();
      const password = String(row["Password"] || username).trim();

      if (!username || !fullName) {
        errors.push(`Baris ${rowNum}: Username atau Nama kosong`);
        skipped++;
        continue;
      }

      // Check duplicate
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

      // If siswa, create student record
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

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Max 10 errors shown
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Gagal import data" }, { status: 500 });
  }
}
