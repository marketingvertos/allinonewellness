import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MilestoneHolder {
  milestone: string;
  icon: string;
  threshold: number;
  sortOrder: number;
  members: { id: string; name: string }[];
}

/** Members currently holding each weight milestone, grouped by milestone. */
export function useMilestoneHolders() {
  return useQuery({
    queryKey: ["milestone-holders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_achievements")
        .select(
          "member_id, achievement_definitions(name, icon, threshold, sort_order, category), wellness_members(full_name)",
        );
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        member_id: string;
        achievement_definitions: {
          name: string;
          icon: string;
          threshold: number;
          sort_order: number;
          category: string;
        } | null;
        wellness_members: { full_name: string } | null;
      }[];
      const groups = new Map<string, MilestoneHolder>();
      for (const r of rows) {
        const d = r.achievement_definitions;
        if (!d || d.category === "referral") continue;
        const g = groups.get(d.name) ?? {
          milestone: d.name,
          icon: d.icon,
          threshold: Number(d.threshold),
          sortOrder: d.sort_order,
          members: [],
        };
        g.members.push({ id: r.member_id, name: r.wellness_members?.full_name ?? "Member" });
        groups.set(d.name, g);
      }
      return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });
}

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online transfer" },
  { value: "other", label: "Other" },
];

export function paymentModeLabel(mode: string | null | undefined) {
  return PAYMENT_MODES.find((m) => m.value === mode)?.label ?? "Cash";
}

export interface RevenueRow {
  id: string;
  membership_code: string;
  price_paid: number;
  payment_mode: string | null;
  payment_date: string | null;
  start_date: string;
  wellness_members?: { full_name: string; mobile_number: string } | null;
  wellness_plans?: { name: string } | null;
}

export function useRevenueReport(from: string, to: string) {
  return useQuery({
    queryKey: ["revenue-report", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_memberships")
        .select(
          "id, membership_code, price_paid, payment_mode, payment_date, start_date, wellness_members(full_name, mobile_number), wellness_plans(name)",
        )
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      const rows = data as unknown as RevenueRow[];
      const total = rows.reduce((sum, r) => sum + Number(r.price_paid ?? 0), 0);

      // Split payments are recorded as individual lines; memberships sold before
      // that feature only carry a single mode on the membership row.
      const ids = rows.map((r) => r.id);
      let lines: { membership_id: string; amount: number; mode: string }[] = [];
      if (ids.length) {
        const { data: payData, error: payErr } = await supabase
          .from("wellness_payments")
          .select("membership_id, amount, mode")
          .in("membership_id", ids);
        if (payErr) throw payErr;
        lines = (payData ?? []) as unknown as typeof lines;
      }
      const withLines = new Set(lines.map((l) => l.membership_id));

      const byMode = new Map<string, { total: number; count: number }>();
      const add = (key: string, amount: number) => {
        const cur = byMode.get(key) ?? { total: 0, count: 0 };
        cur.total += amount;
        cur.count += 1;
        byMode.set(key, cur);
      };
      for (const l of lines) add(l.mode, Number(l.amount ?? 0));
      for (const r of rows) {
        if (withLines.has(r.id)) continue;
        add(r.payment_mode ?? "cash", Number(r.price_paid ?? 0));
      }
      return { rows, total, count: rows.length, byMode: [...byMode.entries()] };
    },
  });
}
