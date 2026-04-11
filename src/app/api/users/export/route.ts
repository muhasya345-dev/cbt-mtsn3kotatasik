import { NextResponse } from "next/server";
import { ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import * as XLSX from "xlsx";

// Export admin & guru users only (with password)
export async function GET() {
  try {
    await requireRole("admin");
    const db = await getDb();

    const data = await db.select({
      username: users.username,
      plainPassword: users.plainPassword,
      fullName: users.fullName,
      role: users.role,
      nip: users.nip,
      isActive: users.isActive,
    }).from(users)
      .where(ne(users.role, "siswa"))
      .orderBy(users.fullName);

    const exportData = data.map((u) => ({
      "Username": u.username,
      "Password": u.plainPassword || "",
      "Nama Lengkap": u.fullName,
      "Role": u.role,
      "NIP": u.nip || "",
      "Status": u.isActive ? "Aktif" : "Nonaktif",
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportData);

    sheet["!cols"] = [
      { wch: 22 }, { wch: 20 }, { wch: 35 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, "Admin & Guru");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="users-admin-guru.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
