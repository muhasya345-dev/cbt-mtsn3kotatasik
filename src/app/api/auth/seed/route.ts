import { NextResponse } from "next/server";
import { seedDefaultAdmin } from "@/db/seed";

export async function POST() {
  try {
    await seedDefaultAdmin();
    return NextResponse.json({ success: true, message: "Seed berhasil" });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Gagal seed database" },
      { status: 500 }
    );
  }
}
