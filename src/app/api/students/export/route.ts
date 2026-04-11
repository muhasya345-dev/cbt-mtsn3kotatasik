import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { students, users, classes } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode"); // "template" or "data"

    if (mode === "template") {
      // Export empty template for import
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
      sheet["!cols"] = [
        { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 10 },
        { wch: 20 }, { wch: 20 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(workbook, sheet, "Template Siswa");
      const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="template-import-siswa.xlsx"`,
        },
      });
    }

    // Export all students with username & password
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
      "NIS": s.nis,
      "NISN": s.nisn || "",
      "Nama Lengkap": s.fullName,
      "Kelas": s.className,
      "L/P": s.gender,
      "Username": s.username,
      "Password": s.plainPassword || "",
      "Tempat Lahir": s.birthPlace || "",
      "Tanggal Lahir": s.birthDate || "",
      "Status": s.isActive ? "Aktif" : "Nonaktif",
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportData);
    sheet["!cols"] = [
      { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 5 },
      { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Data Siswa");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="data-siswa.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
