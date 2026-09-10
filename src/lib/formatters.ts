import { formatDistanceToNow } from "date-fns";

export const APP_TIME_ZONE = "Asia/Kolkata";
export const APP_LOCALE = "en-IN";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

/** Short Indian-style figures: ₹12.5L, ₹1.2Cr */
export function formatCompactCurrency(value: number): string {
  const v = value ?? 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 10000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 100000 ? 0 : 1)}K`;
  return formatCurrency(v);
}

/** Whole years between a YYYY-MM-DD date of birth and today in IST. */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.slice(0, 10));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
  const [ty, tm, td] = todayStr.split("-").map(Number);
  let age = ty - y;
  if (tm < mo || (tm === mo && td < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** e.g. 18 Aug 2026 (IST) */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

/** e.g. 18 Aug 2026 at 4:30 pm (IST) */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  const day = formatDate(d);
  const time = new Intl.DateTimeFormat(APP_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: APP_TIME_ZONE,
  }).format(d);
  return `${day} at ${time}`;
}
