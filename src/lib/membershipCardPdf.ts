import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";
import type { WellnessMembership, WellnessTrial, WellnessPayment, BodyMeasurement, WellnessMember } from "@/hooks/useWellness";
import { formatDate, todayIst } from "./formatters";
import { statusLabel } from "@/components/wellness/status";
import { modeLabel } from "@/components/wellness/memberMeta";

type RGB = [number, number, number];
const TEAL: RGB = [1, 78, 78];
const LEMON: RGB = [233, 207, 50];
const GOLD: RGB = [196, 160, 20];
const WHITE: RGB = [255, 255, 255];
const DARK: RGB = [28, 32, 36];
const GREY: RGB = [120, 128, 134];
const LINE: RGB = [226, 230, 232];
const ZEBRA: RGB = [246, 248, 247];

let logoCache: string | null | undefined;

/** Logo downscaled to ~200px so the PDF stays a few KB instead of MBs. */
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
    ctx.fillStyle = "#014e4e"; // header colour, so JPEG needs no transparency
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bmp, 0, 0, size, size);
    logoCache = c.toDataURL("image/jpeg", 0.85);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export interface MembershipCardData {
  member: WellnessMember & { activation_code?: string | null };
  memberships: WellnessMembership[];
  trials: WellnessTrial[];
  payments: WellnessPayment[];
  bodyMeasurement: BodyMeasurement | null;
  plans: { id: string; name: string; price?: number | null; plan_type?: string | null }[];
  coach: { name: string; mobile: string } | null;
}

const fmt = (n: number | null | undefined) => (n != null ? String(n) : "—");
const rupees = (n: number) => (n > 0 ? `Rs ${n.toLocaleString("en-IN")}` : "Free");

interface HistoryEntry { sortKey: string; date: string; details: string; amount: string }

function buildHistory(data: MembershipCardData): HistoryEntry[] {
  const planMap = new Map(data.plans.map((p) => [p.id, p]));
  const msMap = new Map(data.memberships.map((m) => [m.id, m]));
  const entries: HistoryEntry[] = [];
  for (const t of data.trials) {
    if (t.status === "cancelled") continue;
    const plan = t.plan_id ? planMap.get(t.plan_id) : null;
    entries.push({ sortKey: t.start_date, date: formatDate(t.start_date), details: plan?.name ?? `${t.duration_days}-Day Trial`, amount: rupees(Number(plan?.price ?? 0)) });
  }
  for (const m of data.memberships) {
    if (m.status === "cancelled" || m.renewed_from) continue;
    const plan = planMap.get(m.plan_id) ?? m.wellness_plans;
    entries.push({ sortKey: m.start_date, date: formatDate(m.start_date), details: plan?.name ?? "Membership", amount: rupees(Number(m.price_paid ?? 0)) });
  }
  for (const p of data.payments) {
    if (p.context !== "renewal" || Number(p.amount) <= 0) continue;
    const ms = p.membership_id ? msMap.get(p.membership_id) : null;
    const planId = p.plan_id ?? ms?.plan_id;
    const plan = planId ? planMap.get(planId) : null;
    entries.push({ sortKey: p.paid_at, date: formatDate(p.paid_at), details: `Renewal — ${plan?.name ?? ms?.wellness_plans?.name ?? "Membership"}`, amount: rupees(Number(p.amount)) });
  }
  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return entries;
}

export async function downloadMembershipCard(data: MembershipCardData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const img = await loadLogo();
  const F = 4; // yellow frame
  const IN = F + 3; // inner content x
  const CW = W - IN * 2;
  const m = data.member;

  const frame = () => {
    doc.setFillColor(...LEMON);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...WHITE);
    doc.roundedRect(F, F, W - F * 2, H - F * 2 - 4, 2, 2, "F");
  };

  const header = () => {
    doc.setFillColor(...TEAL);
    doc.roundedRect(F, F, W - F * 2, 15, 2, 2, "F");
    doc.rect(F, F + 12, W - F * 2, 3, "F");
    let tx = IN;
    if (img) {
      try { doc.addImage(img, "JPEG", IN - 1, F + 2, 11, 11, "logo", "FAST"); tx = IN + 12; } catch { /* ignore */ }
    }
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("UNIVERSAL MEMBERSHIP CARD", tx, F + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...LEMON);
    doc.text("All In One Wellness  ·  Yellow Card", tx, F + 11.5);
    doc.setFillColor(...GOLD);
    doc.rect(F, F + 15, W - F * 2, 0.6, "F");
  };

  const sectionTitle = (t: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...TEAL);
    doc.text(t, IN, y);
    doc.setFillColor(...GOLD);
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
  doc.setFillColor(...TEAL);
  doc.roundedRect(IN + CW - sw, y - 3.3, sw, 4.2, 1, 1, "F");
  doc.setTextColor(...WHITE);
  doc.text(st, IN + CW - sw / 2, y - 0.4, { align: "center" });

  const regNo = (m as any).activation_code ?? data.memberships[0]?.membership_code ?? "—";
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
  const rows: [string, string, string, string][] = [
    ["Date of joining", formatDate(m.joining_date), "Date of birth", m.date_of_birth ? formatDate(m.date_of_birth) : "—"],
    ["Anniversary", m.anniversary_date ? formatDate(m.anniversary_date) : "—", "Wellness coach", data.coach?.name ?? "—"],
    ["Coach mobile", data.coach?.mobile ?? "—", "Mode", modeLabel(m.member_mode)],
  ];
  for (const r of rows) {
    field(r[0], r[1], 0, y);
    field(r[2], r[3], 1, y);
    y += 7.5;
  }

  // --- Active plan strip ---
  const active = data.memberships.find((ms) => ms.status === "active" || ms.status === "expiring_soon");
  if (active) {
    const planName = active.wellness_plans?.name ?? data.plans.find((p) => p.id === active.plan_id)?.name ?? "Membership";
    doc.setFillColor(...TEAL);
    doc.roundedRect(IN, y - 2, CW, 8, 1.2, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...LEMON);
    doc.text("ACTIVE PLAN", IN + 2.5, y + 0.8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(planName, IN + 2.5, y + 4.2, { maxWidth: CW - 28 });
    doc.setFontSize(11);
    doc.setTextColor(...LEMON);
    doc.text(String(active.remaining_servings), IN + CW - 13, y + 3.6, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(...WHITE);
    doc.text("servings", IN + CW - 12, y + 1.6);
    doc.text("left", IN + CW - 12, y + 4);
    y += 10.5;
  }

  // --- Target result tiles ---
  sectionTitle("TARGET RESULT", y);
  y += 3;
  const bm = data.bodyMeasurement;
  const metrics: [string, string][] = [
    ["Fat %", fmt(bm?.body_fat_percentage)], ["Visceral fat", fmt(bm?.visceral_fat)], ["Body age", fmt(bm?.body_age)],
    ["BMI", fmt(bm?.bmi)], ["Weight (kg)", fmt(bm?.weight ?? m.current_weight)], ["Muscle mass", fmt(bm?.muscle_mass)],
  ];
  const gap = 1.5;
  const tW = (CW - gap * 2) / 3;
  const tH = 8;
  metrics.forEach(([label, value], idx) => {
    const cx = IN + (idx % 3) * (tW + gap);
    const cy = y + Math.floor(idx / 3) * (tH + gap);
    doc.setFillColor(...ZEBRA);
    doc.setDrawColor(...LINE);
    doc.roundedRect(cx, cy, tW, tH, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.6);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), cx + tW / 2, cy + 2.8, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(value, cx + tW / 2, cy + 6.6, { align: "center" });
  });
  y += tH * 2 + gap + 5;

  // --- History ---
  sectionTitle("PLAN & PAYMENT HISTORY", y);
  y += 3;
  const history = buildHistory(data);
  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Plan", "Amount"]],
    body: history.map((h, i) => [String(i + 1), h.date, h.details, h.amount]),
    margin: { left: IN, right: IN, top: F + 20, bottom: 12 },
    tableWidth: CW,
    theme: "plain",
    styles: { fontSize: 5.8, cellPadding: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 }, textColor: DARK, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: TEAL, textColor: WHITE, fontStyle: "bold", fontSize: 5.5 },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 5, halign: "center", textColor: GREY },
      1: { cellWidth: 18 },
      2: { cellWidth: "auto", fontStyle: "bold" },
      3: { cellWidth: 16, halign: "right", fontStyle: "bold" },
    },
    willDrawPage: (hd) => {
      if (hd.pageNumber > 1) { frame(); header(); }
    },
  });

  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text("No plan history recorded yet.", W / 2, y + 9, { align: "center" });
  }

  // Footer on the yellow frame
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...TEAL);
    doc.text(`Generated ${generated} IST`, F + 1, H - 2.4);
    doc.text(`All In One Wellness  ·  ${pg}/${pages}`, W - F - 1, H - 2.4, { align: "right" });
  }

  const safeName = m.full_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
  doc.save(`UMS-${safeName}-${todayIst()}.pdf`);
}
