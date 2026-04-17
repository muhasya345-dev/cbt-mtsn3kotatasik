/**
 * Algoritma penempatan duduk siswa di ruangan ujian.
 *
 * Rules:
 * - Kapasitas per meja (tableCapacity) — 1/2/3/4 kursi per meja.
 * - Mix grades (mixGrades) — jika true, satu meja TIDAK boleh isi grade sama.
 * - Sort mode "class-order" — urut kelas + selang-seling angkatan (default).
 *
 * Nomor peserta format: {YY}{YY}-{CLASS}-{RR}{SSS}
 *   - YYYY  = short academic year (2025/2026 → "2526")
 *   - CLASS = class name siswa (mis. "7A")
 *   - RR    = nomor ruang 2 digit (dari ekstraksi nama ruangan)
 *   - SSS   = nomor urut dalam ruangan (seat_number, 3 digit)
 *
 * Contoh: 2526-7A-01001 (siswa kelas 7A, ruang 01, kursi 001)
 */

export interface PlacementStudent {
  id: string;
  gradeLevel: number;
  classId: string;
  className: string;
  fullName: string;
  nis: string;
}

export interface PlacementRoom {
  id: string;
  name: string;
  capacity: number;
  tableCapacity: number;
  mixGrades: boolean;
}

export interface PlacementOptions {
  sortMode: "class-order" | "shuffle";
  academicYear: string; // e.g. "2025/2026"
}

export interface PlacementResult {
  roomId: string;
  studentId: string;
  seatNumber: number;
  participantNumber: string;
}

/**
 * Ubah "2025/2026" → "2526".
 */
export function shortAcademicYear(ay: string): string {
  const m = ay.match(/(\d{4}).*(\d{4})/);
  if (!m) return ay.replace(/\D/g, "").slice(-4) || "0000";
  return m[1].slice(-2) + m[2].slice(-2);
}

/**
 * Ekstrak nomor 2-digit dari nama ruangan.
 * "Ruang 1" → "01", "R-12" → "12", "Lab A" → "LA" (fallback alfanumerik).
 */
export function roomCode2(name: string): string {
  const digits = name.match(/\d+/);
  if (digits) return digits[0].padStart(2, "0").slice(-2);
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 2) || "XX").padEnd(2, "X");
}

/**
 * Urutkan siswa per grade, dalam grade tetap urut kelas (className ASC), dalam kelas urut NIS ASC.
 * Return: Map<gradeLevel, PlacementStudent[]>
 */
function groupAndSort(students: PlacementStudent[]): Map<number, PlacementStudent[]> {
  const byGrade = new Map<number, PlacementStudent[]>();
  for (const s of students) {
    const arr = byGrade.get(s.gradeLevel) ?? [];
    arr.push(s);
    byGrade.set(s.gradeLevel, arr);
  }
  for (const [, arr] of byGrade) {
    arr.sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.nis.localeCompare(b.nis);
    });
  }
  return byGrade;
}

/**
 * Interleave grades round-robin: [g1[0], g2[0], g1[1], g2[1], ...]
 * Dapat deret panjang dengan grade selang-seling.
 */
function interleaveGrades(byGrade: Map<number, PlacementStudent[]>): PlacementStudent[] {
  const grades = Array.from(byGrade.keys()).sort((a, b) => a - b);
  const queues = grades.map((g) => [...(byGrade.get(g) ?? [])]);
  const out: PlacementStudent[] = [];
  let idx = 0;
  let exhausted = 0;
  while (exhausted < queues.length) {
    const q = queues[idx % queues.length];
    if (q.length > 0) {
      out.push(q.shift()!);
      exhausted = 0;
    } else {
      exhausted += 1;
    }
    idx += 1;
    if (idx > 10_000_000) break; // safety
  }
  return out;
}

/**
 * Cek apakah row (meja) masih boleh isi siswa `s` (rule: beda grade).
 */
function tableAcceptsStudent(
  tableSeats: PlacementStudent[],
  s: PlacementStudent,
  mixGrades: boolean,
): boolean {
  if (!mixGrades) return true;
  return !tableSeats.some((x) => x.gradeLevel === s.gradeLevel);
}

/**
 * Core algorithm: alokasi siswa ke ruangan mengikuti urutan ruang (ASC),
 * dalam ruang, urutan meja + seat, dengan constraint beda grade per meja.
 */
export function computePlacement(
  students: PlacementStudent[],
  roomsInput: PlacementRoom[],
  options: PlacementOptions,
): { results: PlacementResult[]; unplaced: PlacementStudent[]; warnings: string[] } {
  if (students.length === 0 || roomsInput.length === 0) {
    return { results: [], unplaced: [], warnings: [] };
  }

  // 1. Sort ruangan berdasarkan kode (Ruang 1, 2, 3, ...)
  const rooms = [...roomsInput].sort((a, b) => {
    const ca = roomCode2(a.name);
    const cb = roomCode2(b.name);
    return ca.localeCompare(cb);
  });

  // 2. Bangun queue siswa: selang-seling per grade, urut kelas+NIS.
  const grouped = groupAndSort(students);
  const queue = interleaveGrades(grouped);

  const shortYear = shortAcademicYear(options.academicYear);
  const results: PlacementResult[] = [];
  const warnings: string[] = [];

  // 3. Iterasi tiap ruangan → tiap meja → tiap seat.
  for (const room of rooms) {
    const code = roomCode2(room.name);
    const tableCap = Math.max(1, room.tableCapacity);
    const numTables = Math.ceil(room.capacity / tableCap);

    let seatCounter = 0;

    for (let t = 0; t < numTables && seatCounter < room.capacity; t++) {
      const tableSeats: PlacementStudent[] = [];
      for (let s = 0; s < tableCap && seatCounter < room.capacity; s++) {
        // Cari siswa dari queue yang cocok dengan constraint meja
        let pick: PlacementStudent | null = null;
        let pickIdx = -1;
        for (let i = 0; i < queue.length; i++) {
          if (tableAcceptsStudent(tableSeats, queue[i], room.mixGrades)) {
            pick = queue[i];
            pickIdx = i;
            break;
          }
        }
        if (!pick) {
          // Tidak bisa memenuhi constraint — ambil siswa pertama saja sebagai fallback
          if (queue.length > 0) {
            pick = queue[0];
            pickIdx = 0;
            warnings.push(
              `Ruang ${room.name} meja ${t + 1}: tidak bisa penuhi rule beda angkatan — ditempati ${pick.fullName}.`,
            );
          } else {
            break;
          }
        }
        queue.splice(pickIdx, 1);
        tableSeats.push(pick);

        seatCounter += 1;
        const seatNumStr = String(seatCounter).padStart(3, "0");
        const participantNumber = `${shortYear}-${pick.className}-${code}${seatNumStr}`;
        results.push({
          roomId: room.id,
          studentId: pick.id,
          seatNumber: seatCounter,
          participantNumber,
        });
      }
    }
  }

  return { results, unplaced: [...queue], warnings };
}
