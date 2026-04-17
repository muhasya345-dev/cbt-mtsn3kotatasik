import * as XLSX from "xlsx";

export interface RoomParticipant {
  nis: string;
  nisn: string;
  fullName: string;
  className: string;
}

export interface RoomExcelData {
  roomName: string;
  participants: RoomParticipant[];
}

export interface RoomParticipantsExcelInput {
  examEventName: string;
  academicYear: string;
  semester: string;
  rooms: RoomExcelData[];
}

/**
 * Generate a multi-sheet XLSX — one sheet per room — with kop-style header
 * rows on top of the table. Column widths are tuned for readability.
 */
export function generateRoomParticipantsExcel(data: RoomParticipantsExcelInput) {
  const wb = XLSX.utils.book_new();
  const semesterLabel = data.semester === "ganjil" ? "Ganjil" : "Genap";

  for (const room of data.rooms) {
    const aoa: (string | number)[][] = [
      ["KEMENTERIAN AGAMA REPUBLIK INDONESIA"],
      ["KANTOR KEMENTERIAN AGAMA KOTA TASIKMALAYA"],
      ["MADRASAH TSANAWIYAH NEGERI 3 KOTA TASIKMALAYA"],
      ["Jalan Nagarakasih No. 10 Kersanagara Kota Tasikmalaya  Tlp. (0265) 327857"],
      ["Web: www.mtsn3kotatasikmalaya.sch.id  |  Email: mtsn.nagarakasih@gmail.com"],
      [],
      [`DAFTAR PESERTA ${data.examEventName.toUpperCase()}`],
      [`Tahun Pelajaran ${data.academicYear} — Semester ${semesterLabel}`],
      [`Ruang: ${room.roomName}`],
      [`Jumlah Peserta: ${room.participants.length}`],
      [],
      ["No.", "NIS", "NISN", "Nama Lengkap", "Kelas"],
    ];

    room.participants.forEach((p, idx) => {
      aoa.push([idx + 1, p.nis, p.nisn || "-", p.fullName, p.className]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge header + title rows across columns A:E
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } },
    ];

    // Column widths
    ws["!cols"] = [
      { wch: 6 },   // No.
      { wch: 15 },  // NIS
      { wch: 15 },  // NISN
      { wch: 38 },  // Nama Lengkap
      { wch: 10 },  // Kelas
    ];

    // Center-align kop and title rows; bold them
    for (let r = 0; r <= 9; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!cell) continue;
      cell.s = {
        alignment: { horizontal: r <= 7 ? "center" : "left", vertical: "center", wrapText: true },
        font: { bold: r <= 2 || r === 6 || r === 7 || r === 8 },
      };
    }

    // Table header row (index 11) styling
    for (let c = 0; c <= 4; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 11, c })];
      if (!cell) continue;
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E4620" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }

    // Sheet name — Excel limits to 31 chars & restricts /\?*[]:
    const safeName = room.roomName.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName || "Ruangan");
  }

  const filename = `daftar-peserta-${data.examEventName.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
