import { jsPDF } from "jspdf";

interface ExamCardData {
  participantNumber: string;
  studentName: string;
  nis: string;
  className: string;
  roomName: string;
}

interface ExamCardConfig {
  examEventName: string;
  semester: string; // "ganjil" | "genap"
  academicYear: string; // "2025/2026"
  chairpersonName: string;
  chairpersonNip: string;
  printDate: string; // "24 November 2025"
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

export async function generateExamCardPdf(
  cards: ExamCardData[],
  config: ExamCardConfig
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const pageMarginX = 8;
  const pageMarginY = 8;

  // 2 columns × 4 rows = 8 cards per page
  const cols = 2;
  const rows = 4;
  const cardW = (pageW - pageMarginX * 2 - 4) / cols; // ~95mm each, 4mm gap total
  const cardH = (pageH - pageMarginY * 2 - 6) / rows; // ~69mm each, 6mm gap total
  const gapX = 4;
  const gapY = 2;

  // Load logo
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage("/logo-kemenag.png");
  } catch {
    // Continue without logo
  }

  const semesterLabel = config.semester === "ganjil" ? "GANJIL" : "GENAP";

  // Detect short exam name (e.g., "ASAS", "PAS", "PTS", "PAT")
  function getShortExamName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("asas") || lower.includes("asesmen sumatif akhir semester") || lower.includes("pas") || lower.includes("akhir semester")) return "ASAS";
    if (lower.includes("asts") || lower.includes("asesmen sumatif tengah semester") || lower.includes("pts") || lower.includes("tengah semester")) return "ASTS";
    if (lower.includes("asat") || lower.includes("asesmen sumatif akhir tahun") || lower.includes("pat") || lower.includes("akhir tahun")) return "ASAT";
    // Default: use first word or abbreviation
    if (name.length > 8) {
      return name.split(" ").map((w) => w[0]).join("").toUpperCase();
    }
    return name.toUpperCase();
  }

  function drawCard(x: number, y: number, card: ExamCardData) {
    const pad = 3; // inner padding

    // Card border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(x, y, cardW, cardH);

    // ===== HEADER SECTION =====
    const headerH = 18;
    const logoSize = 11;

    // Logo
    if (logoImg) {
      doc.addImage(logoImg, "PNG", x + pad, y + pad, logoSize, logoSize);
    }

    // Institution text (next to logo)
    const textStartX = x + pad + logoSize + 2;
    let ty = y + pad + 2.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text("KEMENTERIAN AGAMA", textStartX, ty);

    ty += 3;
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text("MTS. NEGERI 3 KOTA TASIKMALAYA", textStartX, ty);

    ty += 2.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.5);
    doc.text("Jl. Nagarakasih No.10 Kersanagara", textStartX, ty);

    ty += 2.2;
    doc.text("Kota Tasikmalaya Tlp. (0265)327857", textStartX, ty);

    // Right side: Exam event name block
    const rightBlockX = x + cardW - pad - 28;
    const rightBlockY = y + pad;
    const rightBlockW = 28;
    const rightBlockH = headerH - 2;

    // Background rectangle for exam name
    doc.setFillColor(240, 240, 240);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.roundedRect(rightBlockX, rightBlockY, rightBlockW, rightBlockH, 1, 1, "FD");

    // Short exam name (big)
    const shortName = getShortExamName(config.examEventName);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(shortName, rightBlockX + rightBlockW / 2, rightBlockY + 7, { align: "center" });

    // Semester
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text(`SMT. ${semesterLabel}`, rightBlockX + rightBlockW / 2, rightBlockY + 11, { align: "center" });

    // Academic year
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(`T. A. ${config.academicYear.replace("/", "-")}`, rightBlockX + rightBlockW / 2, rightBlockY + 14.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ===== BODY SECTION =====
    const bodyY = y + headerH + 3;

    // Nomor Peserta
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Nomor Peserta:", x + pad, bodyY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(card.participantNumber || "", x + pad + 26, bodyY);

    // Ruang + Kelas section with vertical divider
    const fieldY = bodyY + 7;
    const fieldLabelW = 14;
    const fieldValueX = x + pad + fieldLabelW + 2;
    const dividerX = fieldValueX + 14;

    // Ruang
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Ruang", x + pad, fieldY);

    // Vertical line after Ruang value
    doc.setLineWidth(0.4);
    doc.line(dividerX, fieldY - 4, dividerX, fieldY + 8);

    // Ruang value
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const roomDisplay = card.roomName.replace(/[Rr]uang\s*/i, "").trim();
    doc.text(roomDisplay, fieldValueX, fieldY);

    // Kelas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Kelas", x + pad, fieldY + 6);

    // Kelas value
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(card.className, fieldValueX, fieldY + 6);

    // ===== FOOTER: Signature section (right-aligned) =====
    const footerRightX = x + cardW - pad;
    const footerY = y + cardH - 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(`Tasikmalaya, ${config.printDate}`, footerRightX, footerY, { align: "right" });

    doc.text("Ketua,", footerRightX - 10, footerY + 3.5, { align: "center" });

    // Signature space (gap)
    // Chairperson name (bold, underlined)
    const nameY = footerY + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text(config.chairpersonName, footerRightX - 10, nameY, { align: "center" });

    // Underline the name
    const nameW = doc.getTextWidth(config.chairpersonName);
    doc.setLineWidth(0.2);
    doc.line(footerRightX - 10 - nameW / 2, nameY + 0.5, footerRightX - 10 + nameW / 2, nameY + 0.5);

    // NIP
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.text(`NIP. ${config.chairpersonNip}`, footerRightX - 10, nameY + 3, { align: "center" });
  }

  // Generate pages
  const totalPages = Math.ceil(cards.length / (cols * rows));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cardIndex = page * cols * rows + row * cols + col;
        if (cardIndex >= cards.length) break;

        const x = pageMarginX + col * (cardW + gapX);
        const y = pageMarginY + row * (cardH + gapY);

        drawCard(x, y, cards[cardIndex]);
      }
    }
  }

  doc.save(`kartu-ujian-${config.examEventName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
