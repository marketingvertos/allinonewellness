import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const byMode = new Map<string, { total: number; count: number }>();
      for (const r of rows) {
        const key = r.payment_mode ?? "cash";
        const cur = byMode.get(key) ?? { total: 0, count: 0 };
        cur.total += Number(r.price_paid ?? 0);
        cur.count += 1;
        byMode.set(key, cur);
      }
      return { rows, total, count: rows.length, byMode: [...byMode.entries()] };
    },
  });
}
