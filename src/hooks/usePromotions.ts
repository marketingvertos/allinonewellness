import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayIst } from "@/lib/formatters";

export type OfferType = "referral_challenge" | "qualification" | "announcement";
export type TargetMetric = "new_referrals" | "new_memberships" | "attendance_days" | "none";

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  reward_description: string;
  banner_message: string | null;
  icon: string;
  offer_type: OfferType;
  target_metric: TargetMetric;
  target_count: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  visibility: "all" | "physical" | "virtual";
  created_by: string | null;
  created_at: string;
}

export interface PromotionProgress {
  id: string;
  promotion_id: string;
  member_id: string;
  current_count: number;
  qualified: boolean;
  qualified_at: string | null;
  reward_claimed: boolean;
  reward_claimed_at: string | null;
  reward_claimed_by: string | null;
  notes: string | null;
}

export type PromotionInput = Omit<Promotion, "id" | "created_at" | "created_by">;

export const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  referral_challenge: "Referral Challenge",
  qualification: "Qualification Journey",
  announcement: "Announcement",
};

export const METRIC_LABEL: Record<TargetMetric, string> = {
  new_referrals: "New referrals",
  new_memberships: "New memberships by referrals",
  attendance_days: "Attendance days",
  none: "No tracking",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function usePromotions(filter: "active" | "expired" | "all" = "all") {
  return useQuery({
    queryKey: ["promotions", filter],
    queryFn: async () => {
      const today = todayIst();
      let q = db.from("wellness_promotions").select("*").order("is_active", { ascending: false }).order("end_date", { ascending: false });
      if (filter === "active") q = q.eq("is_active", true).gte("end_date", today);
      else if (filter === "expired") q = q.or(`is_active.eq.false,end_date.lt.${today}`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Promotion[];
    },
  });
}

export function usePromotionStats() {
  return useQuery({
    queryKey: ["promotion-stats"],
    queryFn: async () => {
      const { data, error } = await db.from("wellness_promotion_progress").select("promotion_id, current_count, qualified");
      if (error) throw error;
      const map: Record<string, { participating: number; qualified: number }> = {};
      for (const r of data ?? []) {
        const s = (map[r.promotion_id] ??= { participating: 0, qualified: 0 });
        if (r.current_count > 0) s.participating++;
        if (r.qualified) s.qualified++;
      }
      return map;
    },
  });
}

export function useSavePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<PromotionInput> }) => {
      if (id) {
        const { error } = await db.from("wellness_promotions").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await db.from("wellness_promotions").insert({ ...values, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["active-promotions"] });
    },
  });
}

export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("wellness_promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export interface ProgressRow extends PromotionProgress {
  member_name: string;
  mobile: string;
}

export function usePromotionAllProgress(promotionId: string | undefined) {
  return useQuery({
    queryKey: ["promotion-all-progress", promotionId],
    enabled: !!promotionId,
    queryFn: async () => {
      const { error: rErr } = await db.rpc("calc_promotion_progress_all", { p_promotion_id: promotionId });
      if (rErr) throw rErr;
      const { data, error } = await db
        .from("wellness_promotion_progress")
        .select("*, wellness_members(full_name, mobile_number)")
        .eq("promotion_id", promotionId)
        .gt("current_count", 0)
        .order("current_count", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => ({
        ...r,
        member_name: r.wellness_members?.full_name ?? "—",
        mobile: r.wellness_members?.mobile_number ?? "",
      })) as ProgressRow[];
    },
  });
}

export function useMarkPromotionReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { progressId: string; claimed: boolean; note?: string }) => {
      const { error } = await db.rpc("mark_promotion_reward", {
        p_progress_id: p.progressId,
        p_claimed: p.claimed,
        p_note: p.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotion-all-progress"] });
      qc.invalidateQueries({ queryKey: ["promotion-stats"] });
    },
  });
}

/** Member portal: offers live today, with this member's refreshed progress. */
export function useMemberOffers(memberId: string | undefined, memberMode: string | undefined) {
  return useQuery({
    queryKey: ["active-promotions", memberId, memberMode],
    enabled: !!memberId,
    queryFn: async () => {
      const today = todayIst();
      let q = db.from("wellness_promotions").select("*").eq("is_active", true).gte("end_date", today).lte("start_date", today).order("end_date");
      if (memberMode) q = q.or(`visibility.eq.all,visibility.eq.${memberMode}`);
      const { data, error } = await q;
      if (error) throw error;
      const promos = (data ?? []) as Promotion[];
      await Promise.all(
        promos.filter((p) => p.offer_type !== "announcement").map((p) =>
          db.rpc("calc_promotion_progress", { p_promotion_id: p.id, p_member_id: memberId }),
        ),
      );
      const { data: prog } = await db.from("wellness_promotion_progress").select("*").eq("member_id", memberId);
      const map = new Map<string, PromotionProgress>(((prog ?? []) as PromotionProgress[]).map((p) => [p.promotion_id, p]));
      const order: Record<OfferType, number> = { referral_challenge: 0, qualification: 1, announcement: 2 };
      return promos
        .sort((a, b) => order[a.offer_type] - order[b.offer_type])
        .map((p) => ({ promo: p, progress: map.get(p.id) ?? null }));
    },
  });
}
