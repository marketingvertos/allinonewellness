/** Shared broadcast tracking rules: recipient stage, funnel rates and failure grouping. */

export type RecipientStage = "pending" | "sent" | "delivered" | "read" | "replied" | "failed" | "skipped";

export interface RecipientLike {
  status: string;
  delivered_at?: string | null;
  read_at?: string | null;
  replied_at?: string | null;
}

/** Furthest stage reached; receipts only ever move a recipient forward. */
export function recipientStage(r: RecipientLike): RecipientStage {
  if (r.status === "skipped") return "skipped";
  if (r.replied_at) return "replied";
  if (r.read_at) return "read";
  if (r.delivered_at) return "delivered";
  if (r.status === "failed") return "failed";
  if (r.status === "sent") return "sent";
  return "pending";
}

export const STAGE_LABEL: Record<RecipientStage, string> = {
  pending: "Queued", sent: "Sent", delivered: "Delivered", read: "Read", replied: "Replied", failed: "Failed", skipped: "Skipped",
};

/** Badge classes use theme tokens only. */
export const STAGE_CLASS: Record<RecipientStage, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  sent: "bg-secondary text-secondary-foreground border-border",
  delivered: "bg-primary/10 text-primary border-primary/30",
  read: "bg-primary text-primary-foreground border-primary",
  replied: "bg-accent text-accent-foreground border-accent",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  skipped: "bg-muted text-muted-foreground border-dashed border-border",
};

export interface BroadcastCounts {
  total_count: number; sent_count: number; failed_count: number; skipped_count: number;
  delivered_count?: number; read_count?: number; replied_count?: number;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** Delivery/read/reply rates are measured against messages actually sent. */
export function funnel(b: BroadcastCounts) {
  const sent = b.sent_count;
  const delivered = b.delivered_count ?? 0;
  const read = b.read_count ?? 0;
  const replied = b.replied_count ?? 0;
  const attempted = sent + b.failed_count;
  return {
    total: b.total_count, sent, delivered, read, replied,
    failed: b.failed_count, skipped: b.skipped_count,
    pending: Math.max(0, b.total_count - sent - b.failed_count - b.skipped_count),
    deliveryRate: pct(delivered, sent),
    readRate: pct(read, sent),
    replyRate: pct(replied, sent),
    failureRate: pct(b.failed_count, attempted),
  };
}

/** Plain-language reason for a failed or skipped recipient. */
export function failureReason(error?: string | null): string {
  const e = String(error || "");
  if (!e) return "Unknown reason";
  if (/ecosystem|131049/i.test(e)) return "Meta marketing limit (try after 24h)";
  if (/131026|not.*whatsapp|undeliverable/i.test(e)) return "Not on WhatsApp";
  if (/invalid|missing.*mobile|131030|100\b/i.test(e)) return "Invalid number";
  if (/duplicate/i.test(e)) return "Duplicate number";
  if (/132012|132000|parameter|IMAGE/i.test(e)) return "Template or picture problem";
  if (/131047|24.?hour|re-?engagement/i.test(e)) return "Outside 24-hour window";
  if (/131056|rate|too many|throttl|130429/i.test(e)) return "Sending too fast (rate limit)";
  if (/cancel/i.test(e)) return "Cancelled";
  if (/blocked|131031|account/i.test(e)) return "WhatsApp account restricted";
  return "Other error";
}

export function groupFailures(rows: { error?: string | null }[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = failureReason(r.error);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}
