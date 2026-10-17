/**
 * Sales are counted from payments actually collected (wellness_payments.paid_at),
 * so renewals that extend an existing membership and several payments on one
 * membership are all counted. Memberships with no payment lines (sold before the
 * ledger existed) fall back to their stored price.
 */
export interface LedgerPayment {
  id: string;
  membership_id: string;
  member_id: string;
  amount: number;
  mode: string;
  reference: string | null;
  context: string;
  paid_at: string;
  note: string | null;
  plan_name: string | null;
  plan_type: string | null;
}

export interface LegacySale {
  id: string;
  member_id: string;
  price_paid: number;
  payment_mode: string | null;
  renewed_from: string | null;
  created_at: string;
  plan_name: string | null;
  plan_type: string | null;
}

export type SaleKind = "new" | "renewal" | "trial" | "miw";

export interface Sale {
  key: string;
  membershipId: string;
  memberId: string;
  planName: string;
  planType: string | null;
  kind: SaleKind;
  amount: number;
  mode: string;
  paidAt: string;
  lines: { amount: number; mode: string; paidAt: string; note: string | null; reference: string | null }[];
}

export function kindOf(context: string | null, planType: string | null, renewed: boolean): SaleKind {
  if (context === "miw") return "miw";
  if (planType === "trial") return "trial";
  if (context === "renewal" || context === "switch" || renewed) return "renewal";
  return "new";
}

export function buildSales(payments: LedgerPayment[], legacy: LegacySale[]): Sale[] {
  const groups = new Map<string, Sale>();
  for (const p of payments) {
    // Online payments are each their own sale; counter split lines are grouped.
    const key = [p.membership_id, p.paid_at, p.plan_name ?? "", p.context, p.mode === "online" ? p.reference ?? p.id : ""].join("|");
    const amt = Number(p.amount ?? 0);
    const line = { amount: amt, mode: p.mode, paidAt: p.paid_at, note: p.note, reference: p.reference };
    const g = groups.get(key);
    if (g) {
      g.amount += amt;
      g.lines.push(line);
    } else {
      groups.set(key, {
        key,
        membershipId: p.membership_id,
        memberId: p.member_id,
        planName: p.plan_name ?? "Plan",
        planType: p.plan_type,
        kind: kindOf(p.context, p.plan_type, false),
        amount: amt,
        mode: p.mode,
        paidAt: p.paid_at,
        lines: [line],
      });
    }
  }
  const withLedger = new Set(payments.map((p) => p.membership_id));
  for (const m of legacy) {
    if (withLedger.has(m.id) || Number(m.price_paid ?? 0) <= 0) continue;
    groups.set(`legacy|${m.id}`, {
      key: `legacy|${m.id}`,
      membershipId: m.id,
      memberId: m.member_id,
      planName: m.plan_name ?? "Plan",
      planType: m.plan_type,
      kind: kindOf(null, m.plan_type, !!m.renewed_from),
      amount: Number(m.price_paid),
      mode: m.payment_mode ?? "cash",
      paidAt: m.created_at,
      lines: [],
    });
  }
  return [...groups.values()].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export function summarise(sales: Sale[]) {
  const s = { revenue: 0, newRevenue: 0, renewalRevenue: 0, trialRevenue: 0, byMode: {} as Record<string, number> };
  for (const x of sales) {
    s.revenue += x.amount;
    if (x.kind === "trial") s.trialRevenue += x.amount;
    else if (x.kind === "renewal") s.renewalRevenue += x.amount;
    else s.newRevenue += x.amount;
    if (x.lines.length) for (const l of x.lines) s.byMode[l.mode] = (s.byMode[l.mode] ?? 0) + l.amount;
    else s.byMode[x.mode] = (s.byMode[x.mode] ?? 0) + x.amount;
  }
  return s;
}
