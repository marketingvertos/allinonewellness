import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";
import type { WellnessMember, PinkCardEntry } from "@/hooks/useWellness";
import { PINK_CARD_SERVING_VALUE } from "@/hooks/useWellness";
import { formatDate, todayIst } from "./formatters";
import { statusLabel } from "@/components/wellness/status";
import { modeLabel } from "@/components/wellness/memberMeta";

type RGB = [number, number, number];
const PINK: RGB = [219, 68, 131];
const DEEP_PINK: RGB = [160, 30, 85];
const ROSE: RGB = [252, 231, 240];
const WHITE: RGB = [255, 255, 255];
const DARK: RGB = [28, 32, 36];
const GREY: RGB = [120, 128, 134];
const LINE: RGB = [232, 210, 220];
const ZEBRA: RGB = [252, 245, 248];

let logoCache: string | null | undefined;

async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const res = await fetch(logo.url);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const size = 200;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#a01e55";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bmp, 0, 0, size, size);
    logoCache = c.toDataURL("image/jpeg", 0.85);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export interface PinkCardPdfData {
  member: WellnessMember & { activation_code?: string | null };
  ledger: PinkCardEntry[];
  referrer: { full_name: string } | null;
  coach: { name: string; mobile: string } | null;
}

const rupees = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

const REASON_LABELS: Record<string, string> = {
  trial_referral: "Trial referral",
  membership_referral: "Membership referral",
  renewal_redemption: "Redeemed at renewal",
  serving_redemption: "Redeemed as extra servings",
  referral_reversal: "Referral reversed",
  manual_adjustment: "Manual adjustment",
};

function reasonLabel(reason: string, referredName?: string | null): string {
  const base = REASON_LABELS[reason] ?? reason;
  return referredName ? `${base} - ${referredName}` : base;
}

function cleanNote(note: string | null): string {
  if (!note) return "";
  return note.replace(/\b(trial_referral|membership_referral|referral_reversal|renewal_redemption|serving_redemption|manual_adjustment)\b/g, (m) => REASON_LABELS[m] ?? m);
}

export async function buildPinkCardPdf(data: PinkCardPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const img = await loadLogo();
  const F = 4;
  const IN = F + 3;
  const CW = W - IN * 2;
  const m = data.member;
  const bal = m.pink_card_balance ?? 0;

  const frame = () => {
    doc.setFillColor(...ROSE);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...WHITE);
    doc.roundedRect(F, F, W - F * 2, H - F * 2 - 4, 2, 2, "F");
  };

  const header = () => {
    doc.setFillColor(...DEEP_PINK);
    doc.roundedRect(F, F, W - F * 2, 15, 2, 2, "F");
    doc.rect(F, F + 12, W - F * 2, 3, "F");
    let tx = IN;
    if (img) {
      try { doc.addImage(img, "JPEG", IN - 1, F + 2, 11, 11, "plogo", "FAST"); tx = IN + 12; } catch { /* ignore */ }
    }
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PINK CARD", tx, F + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...ROSE);
    doc.text("All In One Wellness  ·  Referral Card", tx, F + 11.5);
    doc.setFillColor(...PINK);
    doc.rect(F, F + 15, W - F * 2, 0.6, "F");
  };

  const sectionTitle = (t: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...DEEP_PINK);
    doc.text(t, IN, y);
    doc.setFillColor(...PINK);
    doc.rect(IN, y + 1, 10, 0.5, "F");
  };

  frame();
  header();

  // --- Identity ---
  let y = F + 23;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(m.full_name, IN, y, { maxWidth: CW - 18 });
  const st = statusLabel(m.status).toUpperCase();
  doc.setFontSize(5.5);
  const sw = doc.getTextWidth(st) + 4;
  doc.setFillColor(...DEEP_PINK);
  doc.roundedRect(IN + CW - sw, y - 3.3, sw, 4.2, 1, 1, "F");
  doc.setTextColor(...WHITE);
  doc.text(st, IN + CW - sw / 2, y - 0.4, { align: "center" });

  const regNo = (m as any).activation_code ?? "—";
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY);
  doc.text(`Reg. No ${regNo}  ·  ${modeLabel(m.member_mode)}`, IN, y);

  y += 3;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(IN, y, IN + CW, y);

  // --- 2-column field grid ---
  const colW = CW / 2;
  const field = (label: string, value: string, col: 0 | 1, rowY: number) => {
    const x = IN + col * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x, rowY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text(value, x, rowY + 3.3, { maxWidth: colW - 2 });
  };
  y += 4;
  field("Date of joining", formatDate(m.joining_date), 0, y);
  field("Wellness coach", data.coach?.name ?? "—", 1, y);
  y += 7.5;

  // --- Introduced by ---
  if (data.referrer?.full_name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(...GREY);
    doc.text("INTRODUCED BY", IN, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DEEP_PINK);
    doc.text(data.referrer.full_name, IN, y + 3.3);
    y += 8;
  }

  // --- Balance tiles ---
  y += 1;
  const tileW = (CW - 3) / 2;
  const tileH = 12;

  // Balance tile
  doc.setFillColor(...ROSE);
  doc.setDrawColor(...LINE);
  doc.roundedRect(IN, y, tileW, tileH, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.setTextColor(...GREY);
  doc.text("BALANCE", IN + tileW / 2, y + 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DEEP_PINK);
  doc.text(`${bal} serving${bal === 1 ? "" : "s"}`, IN + tileW / 2, y + 8.5, { align: "center" });

  // Credit value tile
  const cx = IN + tileW + 3;
  doc.setFillColor(...ROSE);
  doc.roundedRect(cx, y, tileW, tileH, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.setTextColor(...GREY);
  doc.text("CREDIT VALUE", cx + tileW / 2, y + 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DEEP_PINK);
  doc.text(rupees(bal * PINK_CARD_SERVING_VALUE), cx + tileW / 2, y + 8.5, { align: "center" });

  y += tileH + 5;

  // --- History table ---
  sectionTitle("REFERRAL & CREDIT HISTORY", y);
  y += 3;

  const ledger = data.ledger;
  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Details", "+/-"]],
    body: ledger.map((row, i) => [
      String(i + 1),
      formatDate(row.created_at),
      reasonLabel(row.reason, row.referred?.full_name) + (cleanNote(row.note) ? ` - ${cleanNote(row.note)}` : ""),
      (row.change > 0 ? "+" : "") + String(row.change),
    ]),
    margin: { left: IN, right: IN, top: F + 20, bottom: 12 },
    tableWidth: CW,
    theme: "plain",
    styles: { fontSize: 5.8, cellPadding: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 }, textColor: DARK, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: DEEP_PINK, textColor: WHITE, fontStyle: "bold", fontSize: 5.5 },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 5, halign: "center", textColor: GREY },
      1: { cellWidth: 18 },
      2: { cellWidth: "auto", fontStyle: "bold" },
      3: { cellWidth: 10, halign: "right", fontStyle: "bold" },
    },
    willDrawPage: (hd) => {
      if (hd.pageNumber > 1) { frame(); header(); }
    },
  });

  if (ledger.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text("No referral activity yet. Refer friends to earn credit.", W / 2, y + 9, { align: "center" });
  }

  // Footer
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...DEEP_PINK);
    doc.text(`Generated ${generated} IST`, F + 1, H - 2.4);
    doc.text(`All In One Wellness  ·  ${pg}/${pages}`, W - F - 1, H - 2.4, { align: "right" });
  }

  const safeName = m.full_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
  const fileName = `PinkCard-${safeName}-${todayIst()}.pdf`;
  const blob = doc.output("blob");
  return { blob, fileName };
}

export async function downloadPinkCard(data: PinkCardPdfData) {
  const { blob, fileName } = await buildPinkCardPdf(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
