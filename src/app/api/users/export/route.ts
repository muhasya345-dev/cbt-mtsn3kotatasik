import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  try {
    await requireRole("admin");
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    const db = await getDb();
    let query = db.select({
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      nip: users.nip,
      isActive: users.isActive,
    }).from(users);

    if (role) {
      const { eq } = await import("drizzle-orm");
      query = query.where(eq(users.role, role as "admin" | "guru" | "siswa")) as typeof query;
    }

    const data = await query.orderBy(users.fullName);

    const exportData = data.map((u) => ({
      "Username": u.username,
      "Nama Lengkap": u.fullName,
      "Role": u.role,
      "NIP": u.nip || "",
      "Status": u.isActive ? "Aktif" : "Nonaktif",
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    sheet["!cols"] = [
      { wch: 20 }, { wch: 35 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, "Users");
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="users-${role || "all"}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
