import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface RoomParticipant {
  participantNumber?: string;
  nis: string;
  nisn: string;
  fullName: string;
  className: string;
}

export interface RoomPdfData {
  roomName: string;
  participants: RoomParticipant[];
}

export interface RoomParticipantsPdfInput {
  examEventName: string;      // e.g. "Asesmen Sumatif Akhir Semester"
  academicYear: string;       // e.g. "2025/2026"
  semester: string;           // "ganjil" | "genap"
  rooms: RoomPdfData[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate a multi-page PDF, one page per room, with Kemenag letterhead.
 * Each page contains the official kop, centered title with exam event and
 * academic year, left-aligned "Ruang: X", then a table of participants.
 */
export async function generateRoomParticipantsPdf(data: RoomParticipantsPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;

  // Load Kemenag logo
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage("/logo-kemenag.png");
  } catch {
    // continue without logo
  }

  for (let i = 0; i < data.rooms.length; i++) {
    if (i > 0) doc.addPage();
    const room = data.rooms[i];

    // ===== KOP (Letterhead) =====
    const kopTop = margin;

    // Logo on left
    if (logoImg) {
      doc.addImage(logoImg, "PNG", margin, kopTop, 25, 25);
    }

    // Text block (centered in the remaining width, starting after logo area)
    const textCenterX = pageW / 2 + 8; // shift slightly right to account for logo
    let y = kopTop + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("KEMENTERIAN AGAMA REPUBLIK INDONESIA", textCenterX, y, { align: "center" });

    y += 5;
    doc.setFontSize(12);
    doc.text("KANTOR KEMENTERIAN AGAMA KOTA TASIKMALAYA", textCenterX, y, { align: "center" });

    y += 5;
    doc.text("MADRASAH TSANAWIYAH NEGERI 3 KOTA TASIKMALAYA", textCenterX, y, { align: "center" });

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Jalan Nagarakasih No. 10 Kersanagara Kota Tasikmalaya  Tlp. (0265) 327857",
      textCenterX,
      y,
      { align: "center" },
    );

    y += 4;
    doc.setFontSize(9);
    doc.text(
      "Web: www.mtsn3kotatasikmalaya.sch.id       Email: mtsn.nagarakasih@gmail.com",
      textCenterX,
      y,
      { align: "center" },
    );

    // Thick + thin double line below kop
    y += 3;
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);
    y += 1.2;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);

    // ===== TITLE =====
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`DAFTAR PESERTA ${data.examEventName.toUpperCase()}`, pageW / 2, y, {
      align: "center",
    });

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const showSemester = data.semester && data.semester !== "none";
    const semesterLabel = data.semester === "ganjil" ? "Ganjil" : data.semester === "genap" ? "Genap" : "";
    const subtitle = showSemester
      ? `Tahun Pelajaran ${data.academicYear} — Semester ${semesterLabel}`
      : `Tahun Pelajaran ${data.academicYear}`;
    doc.text(subtitle, pageW / 2, y, { align: "center" });

    // Ruang (left aligned)
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Ruang: ${room.roomName}`, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Jumlah Peserta: ${room.participants.length}`,
      pageW - margin,
      y,
      { align: "right" },
    );

    // ===== TABLE =====
    const tableStartY = y + 4;
    const rows = room.participants.map((p, idx) => [
      String(idx + 1),
      p.participantNumber || "-",
      p.nis,
      p.nisn || "-",
      p.fullName,
      p.className,
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [["No.", "No. Peserta", "NIS", "NISN", "Nama Lengkap", "Kelas"]],
      body: rows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: 1.8,
        lineColor: [80, 80, 80],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [30, 70, 32], // kemenag green
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 30, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "left" },
        5: { halign: "center", cellWidth: 16 },
      },
      alternateRowStyles: { fillColor: [245, 248, 245] },
      margin: { left: margin, right: margin },
    });

    // Footer page number
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Halaman ${i + 1} dari ${data.rooms.length}`,
      pageW - margin,
      290,
      { align: "right" },
    );
    doc.setTextColor(0, 0, 0);
    // silence lint
    void pageCount;
  }

  const filename = `daftar-peserta-${data.examEventName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
