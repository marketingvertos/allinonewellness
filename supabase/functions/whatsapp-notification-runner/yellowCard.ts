// Server-side Yellow Card PDF (compact, text-only so it stays a few KB).
import { jsPDF } from "npm:jspdf@2.5.1";

type RGB = [number, number, number];
const TEAL: RGB = [1, 78, 78];
const LEMON: RGB = [233, 207, 50];
const DARK: RGB = [28, 32, 36];
const GREY: RGB = [120, 128, 134];

export interface YellowCardData {
  name: string;
  mobile: string;
  plan: string;
  code: string;
  startDate: string;
  totalServings: string;
  remaining: string;
  price: string;
  paymentMode: string;
}

export function buildYellowCard(d: YellowCardData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: [100, 62], orientation: "landscape", compress: true });
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 100, 16, "F");
  doc.setFillColor(...LEMON);
  doc.rect(0, 16, 100, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ALL IN ONE WELLNESS", 6, 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Family Health Club", 6, 12);
  doc.setTextColor(...LEMON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("YELLOW CARD", 94, 9.5, { align: "right" });

  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.text(d.name || "Member", 6, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(`+91 ${d.mobile.replace(/\D/g, "").slice(-10)}`, 6, 29.5);

  const rows: [string, string][] = [
    ["Plan", d.plan],
    ["Membership code", d.code],
    ["Start date", d.startDate],
    ["Servings", `${d.remaining} left of ${d.totalServings}`],
    ["Amount paid", d.price ? `Rs. ${d.price}${d.paymentMode ? ` (${d.paymentMode.toUpperCase()})` : ""}` : "-"],
  ];
  let y = 36;
  for (const [k, v] of rows) {
    doc.setTextColor(...GREY);
    doc.setFontSize(6.5);
    doc.text(k.toUpperCase(), 6, y);
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(String(v || "-"), 36, y);
    doc.setFont("helvetica", "normal");
    y += 5;
  }
  doc.setFillColor(...TEAL);
  doc.rect(0, 59, 100, 3, "F");
  return new Uint8Array(doc.output("arraybuffer"));
}
