import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";

export type AchievementCategory = "referral" | "weight_loss" | "weight_gain";

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  name: string;
  threshold: number;
  unit: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface ReferredMember {
  id: string;
  full_name: string;
  joining_date: string;
  status: string;
}

function errMessage(error: unknown) {
  const raw = (error as { message?: string })?.message ?? "";
  if (/[.!]$/.test(raw) && raw.length < 160 && !raw.toLowerCase().includes("relation")) return raw;
  return sanitizeErrorMessage(raw);
}

/* --------------------------- Milestone config --------------------------- */

export function useAchievementDefinitions(activeOnly = true) {
  return useQuery({
    queryKey: ["achievement-definitions", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("achievement_definitions")
        .select("*")
        .order("category")
        .order("sort_order");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AchievementDefinition[];
    },
  });
}

export function useSaveAchievementDefinition() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id?: string } & Record<string, unknown>) => {
      if (id) {
        const { error } = await supabase.from("achievement_definitions").update(values as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("achievement_definitions").insert(values as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievement-definitions"] });
      qc.invalidateQueries({ queryKey: ["member-achievements"] });
      toast({ title: "Milestone saved" });
    },
    onError: (error: unknown) =>
      toast({ title: "Could not save milestone", description: errMessage(error), variant: "destructive" }),
  });
}

export function useDeleteAchievementDefinition() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("achievement_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievement-definitions"] });
      qc.invalidateQueries({ queryKey: ["member-achievements"] });
      toast({ title: "Milestone removed" });
    },
    onError: (error: unknown) =>
      toast({ title: "Could not remove milestone", description: errMessage(error), variant: "destructive" }),
  });
}

export function useRecalcAllAchievements() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("recalc_all_member_achievements");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-achievements"] });
      toast({ title: "Achievements recalculated" });
    },
    onError: (error: unknown) =>
      toast({ title: "Could not recalculate", description: errMessage(error), variant: "destructive" }),
  });
}

/* ----------------------------- Member data ----------------------------- */

export function useMemberReferrals(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-referrals", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, full_name, joining_date, status")
        .eq("referred_by_member_id", memberId!)
        .order("joining_date", { ascending: false });
      if (error) throw error;
      return data as unknown as ReferredMember[];
    },
    enabled: !!memberId,
  });
}

export function useUnlockedAchievements(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-achievements", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_achievements")
        .select("achievement_id, unlocked_at")
        .eq("member_id", memberId!);
      if (error) throw error;
      return data as unknown as { achievement_id: string; unlocked_at: string }[];
    },
    enabled: !!memberId,
  });
}

export function useMemberSearch(term: string, excludeId?: string) {
  return useQuery({
    queryKey: ["member-search", term, excludeId ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, status")
        .neq("status", "inactive")
        .order("full_name")
        .limit(20);
      if (term.trim()) q = q.or(`full_name.ilike.%${term}%,mobile_number.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data as unknown as { id: string; full_name: string; mobile_number: string; status: string }[];
      return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
    },
  });
}

/* ------------------------------- Derivation ------------------------------ */

export interface LadderMilestone {
  def: AchievementDefinition;
  unlocked: boolean;
}

export interface LadderState {
  category: AchievementCategory;
  progress: number;
  unit: string;
  /** Every active milestone in the ladder. */
  milestones: LadderMilestone[];
  /** Milestones relevant to this member's own goal (plus one stretch step). */
  visible: LadderMilestone[];
  hiddenCount: number;
  current: AchievementDefinition | null;
  next: AchievementDefinition | null;
  remaining: number;
  pct: number;
}

/** Weight ladders always show at least this much of the journey. */
const BASE_VISIBLE_KG = 20;

export function buildLadder(
  category: AchievementCategory,
  defs: AchievementDefinition[],
  unlockedIds: Set<string>,
  progress: number,
  /** Total kg the member aims to lose/gain. Ignored for referral ladders. */
  goal?: number | null,
): LadderState {
  const list = defs
    .filter((d) => d.category === category && d.is_active)
    .sort((a, b) => Number(a.threshold) - Number(b.threshold));

  const milestones: LadderMilestone[] = list.map((def) => ({
    def,
    unlocked: unlockedIds.has(def.id) || progress >= Number(def.threshold),
  }));

  let visible = milestones;
  if (category !== "referral") {
    const target = Math.max(goal && goal > 0 ? goal : 0, BASE_VISIBLE_KG);
    // Include every milestone up to the first one that meets the goal, plus one stretch step.
    let lastIdx = -1;
    for (let i = 0; i < milestones.length; i++) {
      lastIdx = i;
      if (Number(milestones[i].def.threshold) >= target) break;
    }
    const cutoff = Math.min(lastIdx + 1, milestones.length - 1);
    visible = milestones.filter((m, i) => i <= cutoff || m.unlocked || progress >= Number(m.def.threshold));
  }

  const unlocked = milestones.filter((m) => m.unlocked);
  const current = unlocked.length ? unlocked[unlocked.length - 1].def : null;
  const next = milestones.find((m) => !m.unlocked)?.def ?? null;
  const base = current ? Number(current.threshold) : 0;
  const remaining = next ? Math.max(0, Number((Number(next.threshold) - progress).toFixed(1))) : 0;
  const span = next ? Number(next.threshold) - base : 0;
  const pct = next && span > 0 ? Math.max(0, Math.min(100, Math.round(((progress - base) / span) * 100))) : 100;

  return {
    category,
    progress,
    unit: list[0]?.unit ?? (category === "referral" ? "people" : "kg"),
    milestones,
    visible,
    hiddenCount: milestones.length - visible.length,
    current,
    next,
    remaining,
    pct,
  };
}

