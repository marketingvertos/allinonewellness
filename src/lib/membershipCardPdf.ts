import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";
import type { WellnessMembership, WellnessTrial, WellnessPayment, BodyMeasurement, WellnessMember } from "@/hooks/useWellness";
import { formatDate, todayIst } from "./formatters";
import { statusLabel } from "@/components/wellness/status";
import { modeLabel } from "@/components/wellness/memberMeta";

const TEAL: [number, number, number] = [1, 78, 78];
const YELLOW: [number, number, number] = [249, 214, 123];
const YELLOW_LIGHT: [number, number, number] = [253, 243, 210];
const DARK: [number, number, number] = [40, 40, 40];
const BORDER: [number, number, number] = [80, 80, 60];

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
  const MX = 15;
  const CW = W - 2 * MX;
  const m = data.member;

  const drawBackground = () => {
    doc.setFillColor(...YELLOW);
    doc.rect(MX, 8, CW, H - 16, "F");
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.rect(MX, 8, CW, H - 16, "S");
  };

  const drawHeader = () => {
    const headerY = 8;
    const headerH = 20;
    doc.setFillColor(...TEAL);
    doc.rect(MX, headerY, CW, headerH, "F");

    let tx = MX + 5;
    if (img) {
      try {
        doc.addImage(img, "PNG", MX + 4, headerY + 3, 14, 14);
        tx = MX + 22;
      } catch { /* ignore */ }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Universal Membership Card", tx, headerY + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...YELLOW);
    doc.text("All In One Wellness — Family Health Club", tx, headerY + 14.5);
  };

  drawBackground();
  drawHeader();

  // --- Member details ---
  let y = 34;
  const labelX = MX + 6;
  const valX = MX + 48;
  const lineGap = 6.5;

  const drawField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(label, labelX, y);

    const dots = ".".repeat(40);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 100);
    doc.text(dots, labelX + doc.getTextWidth(label) + 1, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(value, valX, y);
    y += lineGap;
  };

  const drawFieldPair = (l1: string, v1: string, l2: string, v2: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(l1, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 100);
    doc.text("...", labelX + doc.getTextWidth(l1) + 1, y);
    doc.setTextColor(...DARK);
    doc.text(v1, valX, y);

    const col2X = MX + CW / 2 + 4;
    const col2ValX = col2X + 38;
    doc.setFont("helvetica", "bold");
    doc.text(l2, col2X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 100);
    doc.text("...", col2X + doc.getTextWidth(l2) + 1, y);
    doc.setTextColor(...DARK);
    doc.text(v2, col2ValX, y);
    y += lineGap;
  };

  const regNo = (m as any).activation_code ?? data.memberships[0]?.membership_code ?? "—";

  drawField("Name", m.full_name);
  drawFieldPair("Reg. No", regNo, "Date of Joining", formatDate(m.joining_date));
  drawField("DOB", m.date_of_birth ? formatDate(m.date_of_birth) : "—");
  drawField("Anniversary", m.anniversary_date ? formatDate(m.anniversary_date) : "—");
  drawField("Wellness Coach", data.coach?.name ?? "—");
  drawField("Coach Mobile", data.coach?.mobile ?? "—");

  // Status + Mode badges
  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEAL);
  doc.text(`Status: ${statusLabel(m.status)}`, labelX, y);
  doc.text(`Mode: ${modeLabel(m.member_mode)}`, MX + CW / 2 + 4, y);
  y += 3;

  // Active membership info
  const active = data.memberships.find((ms) => ms.status === "active" || ms.status === "expiring_soon");
  if (active) {
    const planName = active.wellness_plans?.name ?? data.plans.find((p) => p.id === active.plan_id)?.name ?? "Membership";
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.2);
    doc.line(labelX, y, MX + CW - 6, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEAL);
    doc.text(`Active Plan: ${planName}`, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(`Servings remaining: ${active.remaining_servings}`, MX + CW / 2 + 4, y);
    y += 3;
  }

  // --- Target Result section ---
  y += 3;
  const trBoxX = MX + CW * 0.15;
  const trBoxW = CW * 0.7;
  const trBoxH = 28;

  doc.setFillColor(...TEAL);
  doc.roundedRect(trBoxX + (trBoxW - 28) / 2, y - 3.5, 28, 5.5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Target Result", trBoxX + trBoxW / 2, y, { align: "center" });
  y += 4;

  const bm = data.bodyMeasurement;
  const gridY = y;
  const cellW = trBoxW / 2;
  const cellH = 7;
  const grid: [string, string, string, string][] = [
    ["Fat", fmt(bm?.body_fat_percentage), "VF", fmt(bm?.visceral_fat)],
    ["B. Age", fmt(bm?.body_age), "BMI", fmt(bm?.bmi)],
    ["Weight", fmt(bm?.weight ?? m.current_weight), "MM", fmt(bm?.muscle_mass)],
  ];

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(trBoxX, gridY, trBoxW, cellH * 3, "S");
  doc.line(trBoxX + cellW, gridY, trBoxX + cellW, gridY + cellH * 3);
  for (let i = 1; i < 3; i++) {
    doc.line(trBoxX, gridY + cellH * i, trBoxX + trBoxW, gridY + cellH * i);
  }

  grid.forEach(([l1, v1, l2, v2], i) => {
    const rowY = gridY + cellH * i + cellH * 0.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(l1, trBoxX + 3, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(v1, trBoxX + cellW - 4, rowY, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(l2, trBoxX + cellW + 3, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(v2, trBoxX + trBoxW - 4, rowY, { align: "right" });
  });

  y = gridY + cellH * 3 + 6;

  // --- Plan & Payment History table ---
  const history = buildHistory(data);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Product Details", "Amount"]],
    body: history.map((h) => [h.date, h.details, h.amount]),
    margin: { left: MX + 3, right: MX + 3, bottom: 18 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: BORDER,
      lineWidth: 0.15,
      textColor: DARK,
      fillColor: YELLOW,
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: YELLOW_LIGHT },
    columnStyles: {
      0: { cellWidth: 30 },
      2: { cellWidth: 28, halign: "right" },
    },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        doc.setFillColor(...YELLOW);
        doc.rect(MX, 8, CW, H - 16, "F");
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.4);
        doc.rect(MX, 8, CW, H - 16, "S");

        doc.setFillColor(...TEAL);
        doc.rect(MX, 8, CW, 10, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${m.full_name} — Universal Membership Card`, MX + 5, 14.5);
      }
    },
  });

  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 80);
    doc.text("No plan history recorded yet.", MX + CW / 2, y + 8, { align: "center" });
  }

  // Footer on every page
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 60);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated ${generated} IST`, MX + 4, H - 4);
    if (pages > 1) doc.text(`Page ${p} of ${pages}`, W - MX - 4, H - 4, { align: "right" });
  }

  const safeName = m.full_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
  doc.save(`UMS-${safeName}-${todayIst()}.pdf`);
}
