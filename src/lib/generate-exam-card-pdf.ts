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
  const cardW = (pageW - pageMarginX * 2 - 4) / cols; // ~95mm each
  const cardH = (pageH - pageMarginY * 2 - 6) / rows; // ~69mm each
  const gapX = 4;
  const gapY = 2;

  // Load BLACK & WHITE logo for exam cards
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage("/logo-kemenag-bw.png");
  } catch {
    // Fallback to color logo if BW not available
    try {
      logoImg = await loadImage("/logo-kemenag.png");
    } catch {
      // Continue without logo
    }
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
    const headerH = 16;
    const logoSize = 11;

    // Logo (black & white)
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
    doc.text(shortName, rightBlockX + rightBlockW / 2, rightBlockY + 6.5, { align: "center" });

    // Semester
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text(`SMT. ${semesterLabel}`, rightBlockX + rightBlockW / 2, rightBlockY + 10.5, { align: "center" });

    // Academic year
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(`T. A. ${config.academicYear.replace("/", "-")}`, rightBlockX + rightBlockW / 2, rightBlockY + 13.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // ===== BODY SECTION =====
    const bodyY = y + headerH + 4;
    const labelX = x + pad;
    const colonX = x + pad + 24;
    const valueX = colonX + 3;

    // Nomor Peserta
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Nomor Peserta", labelX, bodyY);
    doc.text(":", colonX, bodyY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(card.participantNumber || "", valueX, bodyY);

    // Nama Siswa (NEW!)
    const namaY = bodyY + 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Nama", labelX, namaY);
    doc.text(":", colonX, namaY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    // Truncate long names to fit card width
    let displayName = card.studentName;
    const maxNameW = cardW - pad - (valueX - x) - 3;
    while (doc.getTextWidth(displayName) > maxNameW && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName.length < card.studentName.length) displayName += "...";
    doc.text(displayName, valueX, namaY);

    // Ruang + Kelas section with vertical divider
    const fieldY = namaY + 7;
    const dividerX = x + pad + 38;

    // Ruang
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Ruang", labelX, fieldY);
    doc.setFont("helvetica", "normal");
    doc.text(":", colonX, fieldY);

    // Ruang value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const roomDisplay = card.roomName.replace(/[Rr]uang\s*/i, "").trim();
    doc.text(roomDisplay, valueX, fieldY);

    // Vertical line divider
    doc.setLineWidth(0.4);
    doc.setDrawColor(0, 0, 0);
    doc.line(dividerX, fieldY - 4, dividerX, fieldY + 9);

    // Kelas
    const kelasY = fieldY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Kelas", labelX, kelasY);
    doc.setFont("helvetica", "normal");
    doc.text(":", colonX, kelasY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(card.className, valueX, kelasY);

    // ===== FOOTER: Signature section (right-aligned) =====
    const sigCenterX = x + cardW - pad - 18;
    const footerY = y + cardH - 17;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(`Tasikmalaya, ${config.printDate}`, sigCenterX, footerY, { align: "center" });

    doc.text("Ketua,", sigCenterX, footerY + 3.5, { align: "center" });

    // Signature space (gap for ttd)

    // Chairperson name (bold, underlined)
    const nameY = footerY + 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text(config.chairpersonName, sigCenterX, nameY, { align: "center" });

    // Underline the name
    const nameW = doc.getTextWidth(config.chairpersonName);
    doc.setLineWidth(0.2);
    doc.line(sigCenterX - nameW / 2, nameY + 0.5, sigCenterX + nameW / 2, nameY + 0.5);

    // NIP
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.text(`NIP. ${config.chairpersonNip}`, sigCenterX, nameY + 3, { align: "center" });
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
