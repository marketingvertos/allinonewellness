import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";
import type { WellnessMembership, WellnessTrial, WellnessPayment, BodyMeasurement, WellnessMember } from "@/hooks/useWellness";
import { formatDate, todayIst } from "./formatters";
import { statusLabel } from "@/components/wellness/status";
import { modeLabel } from "@/components/wellness/memberMeta";

const TEAL: [number, number, number] = [1, 78, 78];
const BG: [number, number, number] = [255, 249, 230];
const BG_ALT: [number, number, number] = [255, 244, 214];
const GOLD: [number, number, number] = [218, 175, 80];
const DARK: [number, number, number] = [30, 30, 30];
const MID: [number, number, number] = [90, 90, 80];
const GOLD_BORDER: [number, number, number] = [200, 165, 70];

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

export interface MembershipCardData {
  member: WellnessMember & { activation_code?: string | null };
  memberships: WellnessMembership[];
  trials: WellnessTrial[];
  payments: WellnessPayment[];
  bodyMeasurement: BodyMeasurement | null;
  plans: { id: string; name: string; price?: number | null; plan_type?: string | null }[];
  coach: { name: string; mobile: string } | null;
}

function fmt(n: number | null | undefined): string {
  return n != null ? String(n) : "—";
}

function rupees(n: number): string {
  return n > 0 ? `₹${n.toLocaleString("en-IN")}` : "Free";
}

interface HistoryEntry {
  sortKey: string;
  date: string;
  details: string;
  amount: string;
}

function buildHistory(data: MembershipCardData): HistoryEntry[] {
  const planMap = new Map(data.plans.map((p) => [p.id, p]));
  const msMap = new Map(data.memberships.map((m) => [m.id, m]));
  const entries: HistoryEntry[] = [];

  for (const t of data.trials) {
    if (t.status === "cancelled") continue;
    const plan = t.plan_id ? planMap.get(t.plan_id) : null;
    const name = plan?.name ?? `${t.duration_days}-Day Trial`;
    entries.push({
      sortKey: t.start_date,
      date: formatDate(t.start_date),
      details: name,
      amount: rupees(Number(plan?.price ?? 0)),
    });
  }

  for (const m of data.memberships) {
    if (m.status === "cancelled") continue;
    const plan = planMap.get(m.plan_id) ?? m.wellness_plans;
    const isOriginal = !m.renewed_from;
    if (isOriginal) {
      entries.push({
        sortKey: m.start_date,
        date: formatDate(m.start_date),
        details: plan?.name ?? "Membership",
        amount: rupees(Number(m.price_paid ?? 0)),
      });
    }
  }

  for (const p of data.payments) {
    if (p.context !== "renewal" || Number(p.amount) <= 0) continue;
    const ms = p.membership_id ? msMap.get(p.membership_id) : null;
    const planId = p.plan_id ?? ms?.plan_id;
    const plan = planId ? planMap.get(planId) : null;
    const planName = plan?.name ?? ms?.wellness_plans?.name ?? "Membership";
    entries.push({
      sortKey: p.paid_at,
      date: formatDate(p.paid_at),
      details: `Renewal — ${planName}`,
      amount: rupees(Number(p.amount)),
    });
  }

  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return entries;
}

export async function downloadMembershipCard(data: MembershipCardData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const img = await loadLogo();
  const MX = 10;
  const CW = W - 2 * MX;
  const m = data.member;

  const drawPageFrame = () => {
    doc.setFillColor(...BG);
    doc.rect(0, 0, W, H, "F");

    doc.setDrawColor(...GOLD_BORDER);
    doc.setLineWidth(0.8);
    doc.rect(MX, MX, CW, H - 2 * MX, "S");

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.rect(MX + 2, MX + 2, CW - 4, H - 2 * MX - 4, "S");
  };

  const drawHeader = () => {
    const hY = MX + 4;
    const hH = 18;
    doc.setFillColor(...TEAL);
    doc.rect(MX + 3, hY, CW - 6, hH, "F");

    let tx = MX + 8;
    if (img) {
      try {
        doc.addImage(img, "PNG", MX + 6, hY + 2, 14, 14);
        tx = MX + 24;
      } catch { /* ignore */ }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Universal Membership Card", tx, hY + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text("All In One Wellness — Family Health Club", tx, hY + 13.5);
  };

  drawPageFrame();
  drawHeader();

  let y = MX + 27;
  const lx = MX + 8;
  const rx = MX + CW - 8;
  const midCol = MX + CW / 2;

  const drawRow = (label: string, value: string, x: number, maxW: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MID);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(value, x, y + 4, { maxWidth: maxW });
  };

  const regNo = (m as any).activation_code ?? data.memberships[0]?.membership_code ?? "—";

  // --- Row 1: Name ---
  drawRow("NAME", m.full_name, lx, CW - 16);
  y += 10;

  // --- Row 2: Reg No | Date of Joining ---
  drawRow("REG. NO", regNo, lx, midCol - lx - 4);
  drawRow("DATE OF JOINING", formatDate(m.joining_date), midCol, rx - midCol);
  y += 10;

  // --- Row 3: DOB | Anniversary ---
  drawRow("DATE OF BIRTH", m.date_of_birth ? formatDate(m.date_of_birth) : "—", lx, midCol - lx - 4);
  drawRow("ANNIVERSARY", m.anniversary_date ? formatDate(m.anniversary_date) : "—", midCol, rx - midCol);
  y += 10;

  // --- Row 4: Coach | Coach Mobile ---
  drawRow("WELLNESS COACH", data.coach?.name ?? "—", lx, midCol - lx - 4);
  drawRow("COACH MOBILE", data.coach?.mobile ?? "—", midCol, rx - midCol);
  y += 10;

  // --- Row 5: Status | Mode ---
  drawRow("STATUS", statusLabel(m.status), lx, midCol - lx - 4);
  drawRow("MODE", modeLabel(m.member_mode), midCol, rx - midCol);
  y += 10;

  // Active plan strip
  const active = data.memberships.find((ms) => ms.status === "active" || ms.status === "expiring_soon");
  if (active) {
    const planName = active.wellness_plans?.name ?? data.plans.find((p) => p.id === active.plan_id)?.name ?? "Membership";
    doc.setFillColor(...TEAL);
    doc.rect(lx, y - 1, rx - lx, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`Active Plan: ${planName}`, lx + 3, y + 3.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Remaining: ${active.remaining_servings} servings`, rx - 3, y + 3.5, { align: "right" });
    y += 10;
  }

  // --- Divider ---
  doc.setDrawColor(...GOLD_BORDER);
  doc.setLineWidth(0.3);
  doc.line(lx, y, rx, y);
  y += 4;

  // --- Target Result ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("TARGET RESULT", W / 2, y, { align: "center" });
  y += 3;

  const bm = data.bodyMeasurement;
  const trX = lx;
  const trW = rx - lx;
  const col3W = trW / 3;
  const cellH = 9;

  const metrics: [string, string][] = [
    ["Fat %", fmt(bm?.body_fat_percentage)],
    ["Visceral Fat", fmt(bm?.visceral_fat)],
    ["Body Age", fmt(bm?.body_age)],
    ["BMI", fmt(bm?.bmi)],
    ["Weight", fmt(bm?.weight ?? m.current_weight)],
    ["Muscle Mass", fmt(bm?.muscle_mass)],
  ];

  doc.setDrawColor(...GOLD_BORDER);
  doc.setLineWidth(0.2);

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const idx = i * 3 + j;
      const cx = trX + j * col3W;
      const cy = y + i * cellH;

      doc.setFillColor(i % 2 === 0 ? 255 : 252, i % 2 === 0 ? 246 : 240, i % 2 === 0 ? 220 : 200);
      doc.rect(cx, cy, col3W, cellH, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MID);
      doc.text(metrics[idx][0], cx + 2, cy + 3.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEAL);
      doc.text(metrics[idx][1], cx + col3W - 2, cy + 7, { align: "right" });
    }
  }

  y += cellH * 2 + 4;

  // --- Divider ---
  doc.setDrawColor(...GOLD_BORDER);
  doc.setLineWidth(0.3);
  doc.line(lx, y, rx, y);
  y += 3;

  // --- Plan & Payment History ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("PLAN & PAYMENT HISTORY", W / 2, y, { align: "center" });
  y += 3;

  const history = buildHistory(data);

  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Plan / Product", "Amount"]],
    body: history.map((h, i) => [String(i + 1), h.date, h.details, h.amount]),
    margin: { left: lx, right: MX + 8, bottom: 16 },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: GOLD_BORDER,
      lineWidth: 0.12,
      textColor: DARK,
      fillColor: BG as any,
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: BG_ALT as any },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 24 },
      3: { cellWidth: 24, halign: "right" },
    },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        doc.setFillColor(...BG);
        doc.rect(0, 0, W, H, "F");
        doc.setDrawColor(...GOLD_BORDER);
        doc.setLineWidth(0.8);
        doc.rect(MX, MX, CW, H - 2 * MX, "S");
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.3);
        doc.rect(MX + 2, MX + 2, CW - 4, H - 2 * MX - 4, "S");

        doc.setFillColor(...TEAL);
        doc.rect(MX + 3, MX + 4, CW - 6, 10, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${m.full_name} — Universal Membership Card`, MX + 8, MX + 10.5);
      }
    },
  });

  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MID);
    doc.text("No plan history recorded yet.", W / 2, y + 8, { align: "center" });
  }

  // Footer on every page
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setTextColor(...MID);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${generated} IST`, MX + 6, H - MX + 1);
    doc.text("All In One Wellness — Family Health Club", W / 2, H - MX + 1, { align: "center" });
    if (pages > 1) doc.text(`Page ${p}/${pages}`, W - MX - 6, H - MX + 1, { align: "right" });
  }

  const safeName = m.full_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
  doc.save(`UMS-${safeName}-${todayIst()}.pdf`);
}
