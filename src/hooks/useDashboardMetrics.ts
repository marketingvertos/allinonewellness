import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayIst } from "@/lib/formatters";
import {
  calculateDashboardMetrics,
  type DashboardMember,
  type DashboardMembership,
  type DashboardPayment,
  type DashboardPlan,
  type DashboardTrial,
} from "@/lib/dashboardMetrics";
import type { MemberModeFilter } from "@/hooks/useWellness";

const PAGE_SIZE = 500;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Avoid silently truncating counts at the database's default row limit. */
export async function readAllMetricRows<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await readPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function useDashboardMetrics(mode: MemberModeFilter) {
  const [today, setToday] = useState(todayIst);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayIst()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useQuery({
    queryKey: ["wellness-dashboard-metrics", today, mode],
    refetchInterval: 30_000,
    queryFn: async () => {
      const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86_400_000)
        .toISOString().slice(0, 10);
      const [members, plans, memberships, trials, payments] = await Promise.all([
        readAllMetricRows<DashboardMember>((from, to) => supabase
          .from("wellness_members")
          .select("id, is_guest, member_mode, joining_date, full_name, mobile_number")
          .order("id").range(from, to)),
        readAllMetricRows<DashboardPlan>((from, to) => supabase
          .from("wellness_plans")
          .select("id, name, plan_type, duration_days, total_servings, price")
          .order("id").range(from, to)),
        readAllMetricRows<DashboardMembership>((from, to) => supabase
          .from("wellness_memberships")
          .select("id, member_id, plan_id, start_date, created_at, renewed_from, status")
          .order("id").range(from, to)),
        readAllMetricRows<DashboardTrial>((from, to) => supabase
          .from("wellness_trials")
          .select("member_id, plan_id, duration_days, start_date, end_date, status")
          .eq("status", "active").eq("duration_days", 3)
          .lte("start_date", today).gte("end_date", today)
          .order("id").range(from, to)),
        readAllMetricRows<DashboardPayment>((from, to) => supabase
          .from("wellness_payments")
          .select("member_id, membership_id, amount, context, paid_at")
          .eq("context", "renewal").gt("amount", 0)
          .gte("paid_at", today + "T00:00:00+05:30")
          .lt("paid_at", tomorrow + "T00:00:00+05:30")
          .order("id").range(from, to)),
      ]);
      const result = calculateDashboardMetrics({ members, plans, memberships, trials, payments, today, mode });
      return {
        ...result,
        memberById: Object.fromEntries(members.map((m) => [m.id, m])),
        planById: Object.fromEntries(plans.map((p) => [p.id, p])),
      };
    },
  });
}
