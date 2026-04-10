import { jsPDF } from "jspdf";

interface RoomLabelData {
  roomName: string;
  examEventName: string;
  academicYear: string;
  semester: string;
  dateRange: string;
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

export async function generateRoomLabelPdf(rooms: RoomLabelData[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;

  // Load logo
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage("/logo-kemenag.png");
  } catch {
    // Logo not available, continue without it
  }

  // Determine exam type label from event name
  function getExamLabel(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("pas") || lower.includes("akhir semester")) return "ASESMEN SUMATIF\nAKHIR SEMESTER";
    if (lower.includes("pts") || lower.includes("tengah semester")) return "ASESMEN SUMATIF\nTENGAH SEMESTER";
    if (lower.includes("pat") || lower.includes("akhir tahun")) return "ASESMEN SUMATIF\nAKHIR TAHUN";
    return name.toUpperCase();
  }

  for (let i = 0; i < rooms.length; i++) {
    if (i > 0) doc.addPage();
    const room = rooms[i];

    const examLabel = getExamLabel(room.examEventName);
    const semesterLabel = room.semester === "ganjil" ? "GANJIL" : "GENAP";

    // ===== TOP SECTION: Logo + Title =====
    const topY = margin;

    // Logo (left side)
    if (logoImg) {
      doc.addImage(logoImg, "PNG", margin, topY, 30, 30);
    }

    // "(ASAS)" vertical text next to logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.saveGraphicsState();
    // Draw rotated text
    const asasX = margin + 34;
    const asasY = topY + 2;
    doc.text("(ASAS)", asasX, asasY + 15, { angle: 90 });
    doc.restoreGraphicsState();

    // Main title
    const titleX = margin + 42;
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");

    const lines = examLabel.split("\n");
    let titleY = topY + 10;
    for (const line of lines) {
      doc.text(line, titleX, titleY);
      titleY += 10;
    }

    // Year badges
    const [yearStart, yearEnd] = room.academicYear.split("/");
    const badgeX = pageW - margin - 28;
    doc.setFillColor(30, 70, 32); // dark green
    doc.roundedRect(badgeX, topY + 2, 26, 10, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(yearStart || "2025", badgeX + 13, topY + 9, { align: "center" });

    doc.roundedRect(badgeX, topY + 14, 26, 10, 1, 1, "F");
    doc.text(yearEnd || "2026", badgeX + 13, topY + 21, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Subtitle: institution name
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("KEMENTERIAN AGAMA", margin, topY + 38);
    doc.setFontSize(8);
    doc.text("MTs. NEGERI 3 KOTA TASIKMALAYA", margin, topY + 43);

    // Date range
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(room.dateRange || `Semester ${semesterLabel}`, titleX, topY + 38);

    // ===== MAIN SECTION: Room Number Box =====
    const boxTop = topY + 55;
    const boxLeft = margin + 5;
    const boxW = pageW - 2 * margin - 10;
    const boxH = pageH - boxTop - margin - 5;

    // Outer border
    doc.setLineWidth(1.5);
    doc.setDrawColor(50, 50, 50);
    doc.rect(boxLeft, boxTop, boxW, boxH);

    // "RUANG" label with line
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(28);
    const ruangText = "RUANG";
    const ruangW = doc.getTextWidth(ruangText);
    doc.text(ruangText, boxLeft + 10, boxTop + 18);

    // Line after "RUANG"
    doc.setLineWidth(1);
    doc.line(boxLeft + 12 + ruangW + 5, boxTop + 14, boxLeft + boxW - 10, boxTop + 14);

    // Room number/name - big centered
    const roomDisplay = extractRoomNumber(room.roomName);
    doc.setFont("helvetica", "bold");

    // Dynamically size the font
    let fontSize = 200;
    doc.setFontSize(fontSize);
    let textW = doc.getTextWidth(roomDisplay);
    while (textW > boxW - 30 && fontSize > 40) {
      fontSize -= 10;
      doc.setFontSize(fontSize);
      textW = doc.getTextWidth(roomDisplay);
    }

    // Center the room number vertically and horizontally in the box
    const textX = boxLeft + boxW / 2;
    const textY = boxTop + boxH / 2 + fontSize * 0.3;
    doc.setTextColor(50, 50, 50);
    doc.text(roomDisplay, textX, textY, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Save
  doc.save("tempelan-ruangan.pdf");
}

function extractRoomNumber(name: string): string {
  // Try to extract just the number from names like "Ruang 15", "Lab 3", etc.
  const match = name.match(/(\d+)/);
  if (match) return match[1];
  return name;
}
