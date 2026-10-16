import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyRow {
  day: string; total_shake: number; wlp: number; new_guest: number; tp_new: number; tp_repeat: number;
  ums15_new: number; ums15_renew: number; ums30_cust_new: number; ums30_cust_renew: number; ums30_coach: number;
  total_amount: number; cash: number; swipe: number; upi: number; online: number; milk: number; product_retail: number;
}

export interface MonthlyAuto {
  total_shake: number; new_guest: number; trials_3day: number; ums15: number; ums30: number;
  ums30_new_cust: number; ums15_new_cust: number; total_customers: number; total_coaches: number;
  total_amount: number; lead_generation_auto: number;
}

export type MonthlyManual = {
  volume_points: number; ae_qualify_count: number; afresh_party_count: number; lead_generation_count: number | null;
  lsd_ticket_count: number; capital_amount: number; total_retail_by_coaches: number;
};

/** WLP evening check-ins per session date for a YYYY-MM month. */
async function wlpCountsByDay(month: string): Promise<Record<string, number>> {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: Record<string, number> = {};
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("wlp_checkins")
      .select("id, wlp_sessions!inner(session_date)")
      .gte("wlp_sessions.session_date", `${month}-01`)
      .lte("wlp_sessions.session_date", `${month}-${String(last).padStart(2, "0")}`)
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    for (const r of (data ?? []) as any[]) {
      const d = r.wlp_sessions?.session_date;
      if (d) out[d] = (out[d] ?? 0) + 1;
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useClubDailyReport(month: string) {
  return useQuery({
    queryKey: ["club-daily", month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_club_daily_report", { p_month: month });
      if (error) throw error;
      const wlp = await wlpCountsByDay(month);
      return ((data ?? []) as any[]).map((r) => {
        const o: any = { ...r, wlp: wlp[String(r.day).slice(0, 10)] ?? 0 };
        for (const k of Object.keys(o)) if (k !== "day") o[k] = Number(o[k] ?? 0);
        return o as DailyRow;
      });
    },
  });
}

export function useClubMonthlyReport(month: string) {
  return useQuery({
    queryKey: ["club-monthly", month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_club_monthly_report", { p_month: month });
      if (error) throw error;
      return data as unknown as MonthlyAuto;
    },
  });
}

export function useMonthlyOps(month: string) {
  return useQuery({
    queryKey: ["monthly-ops", month],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_operations_summary").select("*").eq("month", month).maybeSingle();
      if (error) throw error;
      return data as (MonthlyManual & { month: string }) | null;
    },
  });
}

export function useSaveMonthlyOps(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MonthlyManual>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("monthly_operations_summary")
        .upsert({ month, ...patch, updated_by: u.user?.id }, { onConflict: "month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-ops", month] }),
  });
}

export function useSaveDailyOps(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { log_date: string; milk_amount?: number; product_retail_amount?: number }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_operations_log")
        .upsert({ ...v, updated_by: u.user?.id }, { onConflict: "log_date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["club-daily", month] }),
  });
}
