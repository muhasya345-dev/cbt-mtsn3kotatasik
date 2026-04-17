/**
 * Format label untuk event ujian agar konsisten di seluruh aplikasi.
 * Kalau semester "none" (tanpa semester), kita cukup pakai nama + tahun ajaran.
 */
export interface EventLike {
  name: string;
  academicYear?: string | null;
  semester?: string | null;
}

export function semesterLabel(semester: string | null | undefined): string {
  if (!semester || semester === "none") return "";
  if (semester === "ganjil") return "Ganjil";
  if (semester === "genap") return "Genap";
  return semester;
}

/**
 * Contoh:
 *   - "UAS — TP 2025/2026 · Semester Ganjil"
 *   - "Try Out — TP 2025/2026" (kalau semester="none")
 */
export function formatEventLabel(event: EventLike): string {
  const ay = event.academicYear ? `TP ${event.academicYear}` : "";
  const sem = semesterLabel(event.semester);
  const meta = [ay, sem ? `Semester ${sem}` : ""].filter(Boolean).join(" · ");
  return meta ? `${event.name} — ${meta}` : event.name;
}

/**
 * Versi ringkas untuk baris sekunder (misal di bawah judul halaman).
 */
export function formatEventMeta(event: EventLike): string {
  const ay = event.academicYear ? `TP ${event.academicYear}` : "";
  const sem = semesterLabel(event.semester);
  return [ay, sem ? `Semester ${sem}` : ""].filter(Boolean).join(" · ");
}
