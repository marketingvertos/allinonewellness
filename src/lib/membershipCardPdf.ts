import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/aiow-logo.png.asset.json";
import type { WellnessMembership, WellnessTrial, WellnessPayment, BodyMeasurement, WellnessMember } from "@/hooks/useWellness";
import { formatDate, todayIst } from "./formatters";
import { statusLabel } from "@/components/wellness/status";
import { modeLabel } from "@/components/wellness/memberMeta";

const TEAL: [number, number, number] = [1, 78, 78];
const LEMON: [number, number, number] = [233, 207, 50];
const LEMON_LIGHT: [number, number, number] = [243, 227, 110];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [25, 25, 25];

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
    if (!m.renewed_from) {
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const img = await loadLogo();
  const P = 5;
  const m = data.member;

  const fillBg = () => {
    doc.setFillColor(...LEMON);
    doc.rect(0, 0, W, H, "F");
  };

  const drawHeader = () => {
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, W, 14, "F");

    let tx = 5;
    if (img) {
      try {
        doc.addImage(img, "PNG", 3, 1.5, 11, 11);
        tx = 16;
      } catch { /* ignore */ }
    }

    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Universal Membership Card", tx, 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...LEMON);
    doc.text("All In One Wellness — Family Health Club", tx, 10.5);
  };

  fillBg();
  drawHeader();

  let y = 17;
  const lx = P;
  const rx = W - P;
  const mid = W / 2;
  const colW = mid - lx - 1;

  const field = (label: string, value: string, x: number, w: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(...TEAL);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text(value, x, y + 3, { maxWidth: w });
  };

  const regNo = (m as any).activation_code ?? data.memberships[0]?.membership_code ?? "—";

  field("NAME", m.full_name, lx, rx - lx);
  y += 7;

  field("REG. NO", regNo, lx, colW);
  field("DATE OF JOINING", formatDate(m.joining_date), mid, colW);
  y += 7;

  field("DATE OF BIRTH", m.date_of_birth ? formatDate(m.date_of_birth) : "—", lx, colW);
  field("ANNIVERSARY", m.anniversary_date ? formatDate(m.anniversary_date) : "—", mid, colW);
  y += 7;

  field("WELLNESS COACH", data.coach?.name ?? "—", lx, colW);
  field("COACH MOBILE", data.coach?.mobile ?? "—", mid, colW);
  y += 7;

  field("STATUS", statusLabel(m.status), lx, colW);
  field("MODE", modeLabel(m.member_mode), mid, colW);
  y += 7;

  // Active plan strip
  const active = data.memberships.find((ms) => ms.status === "active" || ms.status === "expiring_soon");
  if (active) {
    const planName = active.wellness_plans?.name ?? data.plans.find((p) => p.id === active.plan_id)?.name ?? "Membership";
    doc.setFillColor(...TEAL);
    doc.rect(lx, y - 1, rx - lx, 5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.text(planName, lx + 2, y + 2);
    doc.text(`${active.remaining_servings} servings left`, rx - 2, y + 2, { align: "right" });
    y += 7;
  }

  // --- Target Result ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...TEAL);
  doc.text("TARGET RESULT", W / 2, y, { align: "center" });
  y += 2;

  const bm = data.bodyMeasurement;
  const metrics: [string, string][] = [
    ["Fat %", fmt(bm?.body_fat_percentage)],
    ["VF", fmt(bm?.visceral_fat)],
    ["B.Age", fmt(bm?.body_age)],
    ["BMI", fmt(bm?.bmi)],
    ["Weight", fmt(bm?.weight ?? m.current_weight)],
    ["MM", fmt(bm?.muscle_mass)],
  ];

  const cW = (rx - lx) / 3;
  const cH = 6;

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const idx = i * 3 + j;
      const cx = lx + j * cW;
      const cy = y + i * cH;

      doc.setFillColor(i === 0 ? 240 : 230, i === 0 ? 230 : 215, i === 0 ? 60 : 40);
      doc.rect(cx, cy, cW, cH, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(4.5);
      doc.setTextColor(...TEAL);
      doc.text(metrics[idx][0], cx + 1.5, cy + 2.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.text(metrics[idx][1], cx + cW - 1.5, cy + 4.5, { align: "right" });
    }
  }

  y += cH * 2 + 3;

  // --- Plan & Payment History ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...TEAL);
  doc.text("PLAN & PAYMENT HISTORY", W / 2, y, { align: "center" });
  y += 2;

  const history = buildHistory(data);

  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Plan", "Amount"]],
    body: history.map((h, i) => [String(i + 1), h.date, h.details, h.amount]),
    margin: { left: lx, right: P, bottom: 8 },
    styles: {
      fontSize: 5.5,
      cellPadding: 1,
      lineWidth: 0,
      textColor: DARK,
      fillColor: LEMON as any,
      fontStyle: "bold",
    },
    headStyles: {
      fillColor: TEAL,
      textColor: WHITE as any,
      fontStyle: "bold",
      halign: "center",
      fontSize: 5.5,
    },
    alternateRowStyles: { fillColor: LEMON_LIGHT as any },
    columnStyles: {
      0: { cellWidth: 5, halign: "center" },
      1: { cellWidth: 16 },
      3: { cellWidth: 16, halign: "right" },
    },
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        doc.setFillColor(...LEMON);
        doc.rect(0, 0, W, H, "F");

        doc.setFillColor(...TEAL);
        doc.rect(0, 0, W, 8, "F");
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.text(`${m.full_name} — UMS`, 4, 5.5);
      }
    },
  });

  if (history.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...TEAL);
    doc.text("No plan history recorded yet.", W / 2, y + 5, { align: "center" });
  }

  // Footer
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFontSize(4.5);
    doc.setTextColor(...TEAL);
    doc.setFont("helvetica", "normal");
    doc.text(`${generated} IST`, lx, H - 2);
    doc.text("All In One Wellness", W / 2, H - 2, { align: "center" });
    if (pages > 1) doc.text(`${pg}/${pages}`, rx, H - 2, { align: "right" });
  }

  const safeName = m.full_name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-");
  doc.save(`UMS-${safeName}-${todayIst()}.pdf`);
}
