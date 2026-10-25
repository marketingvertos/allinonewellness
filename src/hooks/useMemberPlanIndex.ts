import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readAllMetricRows } from "@/hooks/useDashboardMetrics";
import { isGoldCardPlan, isWhiteCardPlan, paymentDateIst, type DashboardPlan } from "@/lib/dashboardMetrics";

export type PlanEventType = "new" | "renewal" | "trial";

export interface PlanEvent {
  memberId: string;
  planId: string | null;
  planName: string;
  family: string;
  type: PlanEventType;
  date: string;
  amount: number | null;
  remaining: number | null;
}

/** Plan family, matching the dashboard card helpers so filters and cards agree. */
export function planFamily(plan: DashboardPlan | undefined, isTrial: boolean): string {
  if (isTrial) return Number(plan?.price ?? 0) > 0 ? "paid_trial" : "free_trial";
  if (isGoldCardPlan(plan)) return "gold";
  if (isWhiteCardPlan(plan)) return "white";
  return "other";
}

export function eventMatches(e: PlanEvent, plan: string, type: string, month: string): boolean {
  if (plan !== "all") {
    if (plan.startsWith("plan:")) { if (e.planId !== plan.slice(5)) return false; }
    else if (e.family !== plan) return false;
  }
  if (type !== "all" && e.type !== type) return false;
  if (month !== "all" && e.date.slice(0, 7) !== month) return false;
  return true;
}

export function useMemberPlanIndex(enabled: boolean) {
  return useQuery({
    queryKey: ["member-plan-index"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [plans, memberships, trials, payments] = await Promise.all([
        readAllMetricRows<DashboardPlan>((f, t) => supabase.from("wellness_plans")
          .select("id, name, plan_type, duration_days, total_servings, price").order("id").range(f, t)),
        readAllMetricRows<{ id: string; member_id: string; plan_id: string; start_date: string; renewed_from: string | null; status: string; price_paid: number; remaining_servings: number }>(
          (f, t) => supabase.from("wellness_memberships")
            .select("id, member_id, plan_id, start_date, renewed_from, status, price_paid, remaining_servings").order("id").range(f, t)),
        readAllMetricRows<{ member_id: string; plan_id: string | null; start_date: string; status: string }>(
          (f, t) => supabase.from("wellness_trials").select("member_id, plan_id, start_date, status").order("id").range(f, t)),
        readAllMetricRows<{ member_id: string; membership_id: string; amount: number; paid_at: string; plan_id: string | null }>(
          (f, t) => supabase.from("wellness_payments").select("member_id, membership_id, amount, paid_at, plan_id")
            .eq("context", "renewal").gt("amount", 0).order("id").range(f, t)),
      ]);
      const planById = new Map(plans.map((p) => [p.id, p]));
      const msById = new Map(memberships.map((m) => [m.id, m]));
      const events: PlanEvent[] = [];
      for (const m of memberships) {
        if (m.status === "cancelled" || m.renewed_from) continue;
        const plan = planById.get(m.plan_id);
        events.push({ memberId: m.member_id, planId: m.plan_id, planName: plan?.name ?? "", family: planFamily(plan, plan?.plan_type === "trial"),
          type: "new", date: m.start_date, amount: Number(m.price_paid ?? 0), remaining: m.remaining_servings });
      }
      // Renewals extend memberships in place, so they come from renewal payments (summed per member/day/plan).
      const renewalKey = new Map<string, PlanEvent>();
      for (const p of payments) {
        const ms = msById.get(p.membership_id);
        if (!ms || ms.status === "cancelled") continue;
        const planId = p.plan_id ?? ms.plan_id;
        const plan = planById.get(planId);
        const date = paymentDateIst(p.paid_at);
        const key = `${p.member_id}|${date}|${planId}`;
        const existing = renewalKey.get(key);
        if (existing) { existing.amount = (existing.amount ?? 0) + Number(p.amount); continue; }
        const ev: PlanEvent = { memberId: p.member_id, planId, planName: plan?.name ?? "", family: planFamily(plan, plan?.plan_type === "trial"),
          type: "renewal", date, amount: Number(p.amount), remaining: ms.remaining_servings };
        renewalKey.set(key, ev);
        events.push(ev);
      }
      for (const t of trials) {
        if (t.status === "cancelled") continue;
        const plan = t.plan_id ? planById.get(t.plan_id) : undefined;
        events.push({ memberId: t.member_id, planId: t.plan_id, planName: plan?.name ?? "Free guest trial", family: planFamily(plan, true),
          type: "trial", date: t.start_date, amount: plan ? Number(plan.price) : 0, remaining: null });
      }
      events.sort((a, b) => b.date.localeCompare(a.date));
      return { events, plans };
    },
  });
}
