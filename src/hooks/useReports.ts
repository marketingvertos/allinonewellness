import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSales } from "@/hooks/useWellness";

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
      // One row per payment collected in the period (renewals of existing plans included).
      const sales = await fetchSales(from, to);
      const memberIds = [...new Set(sales.map((s) => s.memberId))];
      const msIds = [...new Set(sales.map((s) => s.membershipId).filter(Boolean))];
      const [mem, ms] = await Promise.all([
        memberIds.length ? supabase.from("wellness_members").select("id, full_name, mobile_number").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
        msIds.length ? supabase.from("wellness_memberships").select("id, membership_code, start_date").in("id", msIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (mem.error) throw mem.error;
      if (ms.error) throw ms.error;
      const M = new Map((mem.data as { id: string; full_name: string; mobile_number: string }[]).map((m) => [m.id, m]));
      const S = new Map((ms.data as { id: string; membership_code: string; start_date: string }[]).map((m) => [m.id, m]));
      const rows: RevenueRow[] = sales.map((s) => ({
        id: s.key,
        membership_code: S.get(s.membershipId)?.membership_code ?? "",
        price_paid: s.amount,
        payment_mode: s.lines.length > 1 ? s.lines.map((l) => l.mode).join("+") : s.mode,
        payment_date: new Date(s.paidAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
        start_date: S.get(s.membershipId)?.start_date ?? "",
        wellness_members: M.get(s.memberId) ?? null,
        wellness_plans: { name: s.planName },
      }));
      const total = rows.reduce((sum, r) => sum + r.price_paid, 0);
      const byMode = new Map<string, { total: number; count: number }>();
      const add = (key: string, amount: number) => {
        const cur = byMode.get(key) ?? { total: 0, count: 0 };
        cur.total += amount;
        cur.count += 1;
        byMode.set(key, cur);
      };
      for (const s of sales) {
        if (s.lines.length) for (const l of s.lines) add(l.mode, l.amount);
        else add(s.mode, s.amount);
      }
      return { rows, total, count: rows.length, byMode: [...byMode.entries()] };
    },
  });
}

/* --------------------- Monthly weight rewards (Family Day) --------------------- */

export interface WeightRewardRow {
  memberId: string;
  name: string;
  goal: string | null;
  firstWeight: number;
  lastWeight: number;
  /** last − first; negative = lost */
  change: number;
}

export interface MonthlyWeightRewards {
  loss: WeightRewardRow[]; // weight-loss members with 5+ kg lost
  gain: WeightRewardRow[]; // weight-gain members with 3+ kg gained
}

/** Months (YYYY-MM) that have any weigh-ins, from the first reading up to now. */
export function useWeightDataMonths() {
  return useQuery({
    queryKey: ["weight-data-months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_tracking")
        .select("recorded_date")
        .order("recorded_date", { ascending: true })
        .limit(1);
      if (error) throw error;
      const first = (data?.[0]?.recorded_date as string | undefined)?.slice(0, 7);
      const now = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
      if (!first) return [now];
      const months: string[] = [];
      let [y, m] = first.split("-").map(Number);
      const [ey, em] = now.split("-").map(Number);
      while (y < ey || (y === ey && m <= em)) {
        months.push(`${y}-${String(m).padStart(2, "0")}`);
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
      return months;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Members who lost 5+ kg (weight-loss goal) or gained 3+ kg (weight-gain goal) in the month. */
export function useMonthlyWeightRewards(month: string) {
  return useQuery({
    queryKey: ["monthly-weight-rewards", month],
    queryFn: async (): Promise<MonthlyWeightRewards> => {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);

      const rows: { member_id: string; recorded_date: string; weight: number; created_at: string }[] = [];
      const pageSize = 1000;
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from("weight_tracking")
          .select("member_id, recorded_date, weight, created_at")
          .gte("recorded_date", start)
          .lte("recorded_date", end)
          .order("recorded_date", { ascending: true })
          .order("created_at", { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      if (!rows.length) return { loss: [], gain: [] };

      const ids = [...new Set(rows.map((r) => r.member_id))];
      const { data: members, error: memErr } = await supabase
        .from("wellness_members")
        .select("id, full_name, goal")
        .in("id", ids);
      if (memErr) throw memErr;
      const meta = new Map((members ?? []).map((mm) => [mm.id, mm]));

      const byMember = new Map<string, { first: number; last: number }>();
      for (const r of rows) {
        const cur = byMember.get(r.member_id);
        const w = Number(r.weight);
        if (!cur) byMember.set(r.member_id, { first: w, last: w });
        else cur.last = w; // rows arrive in date order
      }

      const loss: WeightRewardRow[] = [];
      const gain: WeightRewardRow[] = [];
      for (const [memberId, { first, last }] of byMember) {
        // Need at least two readings on different dates for a real change.
        const dates = new Set(rows.filter((r) => r.member_id === memberId).map((r) => r.recorded_date));
        if (dates.size < 2) continue;
        const change = Math.round((last - first) * 10) / 10;
        const mm = meta.get(memberId);
        const row: WeightRewardRow = {
          memberId,
          name: mm?.full_name ?? "Member",
          goal: mm?.goal ?? null,
          firstWeight: first,
          lastWeight: last,
          change,
        };
        if (mm?.goal === "weight_gain") {
          if (change >= 3) gain.push(row);
        } else if (change <= -5) {
          loss.push(row);
        }
      }
      loss.sort((a, b) => a.change - b.change);
      gain.sort((a, b) => b.change - a.change);
      return { loss, gain };
    },
  });
}
