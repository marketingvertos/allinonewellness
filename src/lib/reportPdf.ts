import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";

// PDF colors mirror --sidebar-background (dark green) and --sidebar-primary (gold).
const GREEN: [number, number, number] = [13, 52, 58];
const GOLD: [number, number, number] = [248, 210, 128];
const ZEBRA: [number, number, number] = [245, 245, 242];

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logo.url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type PdfSection = { title?: string; head: string[]; body: (string | number)[][]; foot?: (string | number)[]; rightAlignFrom?: number };

export async function downloadBrandedPdf(opts: {
  filename: string;
  title: string;
  period: string;
  orientation: "portrait" | "landscape";
  sections: PdfSection[];
  /** Custom page width in mm (landscape). When set, the page grows to fit wide tables instead of squeezing into A4. */
  pageWidthMm?: number;
  /** Per-section column widths in mm; index matches the column. Unlisted columns share the remaining space. */
  colWidthsMm?: number[];
}) {
  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: "mm",
    format: opts.pageWidthMm ? [210, opts.pageWidthMm] : "a4",
  });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const img = await loadLogo();
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  const drawHeader = () => {
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 22, "F");
    if (img) { try { doc.addImage(img, "PNG", 10, 3, 16, 16); } catch { /* ignore */ } }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("All In One Wellness", img ? 30 : 10, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Family Health Club", img ? 30 : 10, 16);
    doc.setTextColor(...GOLD); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(opts.title, W - 10, 10, { align: "right" });
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(opts.period, W - 10, 16, { align: "right" });
  };

  let y = 28;
  opts.sections.forEach((s) => {
    if (s.title) {
      doc.setTextColor(...GREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(s.title, 10, y + 3); y += 5;
    }
    const cols = s.head.length;
    const fontSize = opts.pageWidthMm ? 8 : cols > 16 ? 6.5 : cols > 10 ? 7.5 : 9.5;
    const colStyles: Record<number, any> = {};
    for (let i = s.rightAlignFrom ?? cols; i < cols; i++) colStyles[i] = { halign: "right" };
    if (opts.colWidthsMm) {
      opts.colWidthsMm.forEach((w, i) => {
        colStyles[i] = { ...(colStyles[i] ?? {}), cellWidth: w };
      });
    }
    autoTable(doc, {
      startY: y,
      head: [s.head],
      body: s.body,
      foot: s.foot ? [s.foot] : undefined,
      margin: { top: 28, left: 10, right: 10, bottom: 14 },
      styles: { fontSize, cellPadding: opts.pageWidthMm ? 2 : 1.4, lineColor: [229, 229, 224], lineWidth: 0.1, textColor: [30, 30, 30] },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", halign: "center", valign: "middle" },
      footStyles: { fillColor: GREEN, textColor: GOLD, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: colStyles,
      showFoot: "lastPage",
      didDrawPage: drawHeader,
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "normal");
    doc.text(`Generated ${generated} IST`, 10, H - 6);
    doc.text(`Page ${p} of ${pages}`, W - 10, H - 6, { align: "right" });
  }
  doc.save(opts.filename);
}
