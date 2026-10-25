import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayIst } from "@/lib/formatters";
import {
  calculateDashboardMetrics,
  type DashboardAttendance,
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

export interface DashboardRange { from: string; to: string }

export function useDashboardMetrics(mode: MemberModeFilter, range?: DashboardRange) {
  const [today, setToday] = useState(todayIst);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayIst()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return useQuery({
    queryKey: ["wellness-dashboard-metrics", today, mode, range?.from, range?.to],
    refetchInterval: 30_000,
    queryFn: async () => {
      const shift = (days: number) =>
        new Date(Date.parse(today + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
      const from = range?.from ?? today;
      const to = range?.to ?? today;
      const shiftD = (d: string, days: number) =>
        new Date(Date.parse(d + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
      const tomorrow = shiftD(to, 1);
      const yesterday = shiftD(from, -1);
      void shift;
      const [members, plans, memberships, trials, payments, attendance] = await Promise.all([
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
          .select("id, member_id, plan_id, duration_days, start_date, end_date, status")
          .gte("start_date", yesterday).lte("start_date", to)
          .order("id").range(from, to)),
        readAllMetricRows<DashboardPayment>((from, to) => supabase
          .from("wellness_payments")
          .select("member_id, membership_id, amount, context, paid_at, plan_id")
          .eq("context", "renewal").gt("amount", 0)
          .gte("paid_at", from + "T00:00:00+05:30")
          .lt("paid_at", tomorrow + "T00:00:00+05:30")
          .order("id").range(from, to)),
        readAllMetricRows<DashboardAttendance>((from, to) => supabase
          .from("wellness_attendance")
          .select("member_id, trial_id, visit_date")
          .gte("visit_date", from).lte("visit_date", to).not("trial_id", "is", null)
          .order("id").range(from, to)),
      ]);
      const result = calculateDashboardMetrics({ members, plans, memberships, trials, payments, attendance, today, from, to, mode });
      return {
        ...result,
        memberById: Object.fromEntries(members.map((m) => [m.id, m])),
        planById: Object.fromEntries(plans.map((p) => [p.id, p])),
      };
    },
  });
}
