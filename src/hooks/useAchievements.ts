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

/** Statuses that count as an "active" member for coach titles. */
export const ACTIVE_MEMBER_STATUSES = ["active_member", "renewal_due"];

export function isActiveMemberStatus(status: string | null | undefined) {
  return !!status && ACTIVE_MEMBER_STATUSES.includes(status);
}

export function istMonthKey(date = new Date()) {
  const ist = new Date(date.getTime() + (330 + date.getTimezoneOffset()) * 60000);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}`;
}

export interface CoachActivity {
  month: string;
  new_memberships: number;
  required_memberships: number;
  met_requirement: boolean;
}

export function useCoachMonthlyActivity(memberId: string | undefined) {
  return useQuery({
    queryKey: ["coach-monthly-activity", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_monthly_activity")
        .select("month, new_memberships, required_memberships, met_requirement")
        .eq("coach_id", memberId!)
        .order("month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as unknown as CoachActivity[];
    },
    enabled: !!memberId,
  });
}

export interface CoachAtRisk {
  id: string;
  full_name: string;
  title: string;
  icon: string;
  done: number;
  required: number;
}

/** Title holders who have not yet met this month's new-membership quota. */
export function useCoachesAtRisk() {
  const month = istMonthKey();
  return useQuery({
    queryKey: ["coaches-at-risk", month],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("member_achievements")
        .select("member_id, achievement_definitions!inner(name, icon, sort_order, category)")
        .eq("achievement_definitions.category", "referral");
      if (error) throw error;

      const best = new Map<string, { name: string; icon: string; sort: number }>();
      for (const r of (rows ?? []) as unknown as {
        member_id: string;
        achievement_definitions: { name: string; icon: string; sort_order: number };
      }[]) {
        const d = r.achievement_definitions;
        const prev = best.get(r.member_id);
        if (!prev || d.sort_order > prev.sort) {
          best.set(r.member_id, { name: d.name, icon: d.icon, sort: d.sort_order });
        }
      }
      const ids = [...best.keys()];
      if (!ids.length) return [] as CoachAtRisk[];

      const [{ data: activity }, { data: members }] = await Promise.all([
        supabase
          .from("coach_monthly_activity")
          .select("coach_id, new_memberships, required_memberships, met_requirement")
          .eq("month", month)
          .in("coach_id", ids),
        supabase.from("wellness_members").select("id, full_name").in("id", ids),
      ]);

      const byCoach = new Map(
        ((activity ?? []) as unknown as {
          coach_id: string;
          new_memberships: number;
          required_memberships: number;
          met_requirement: boolean;
        }[]).map((a) => [a.coach_id, a]),
      );
      const names = new Map(((members ?? []) as { id: string; full_name: string }[]).map((m) => [m.id, m.full_name]));

      return ids
        .map((id) => {
          const t = best.get(id)!;
          const a = byCoach.get(id);
          const required = a?.required_memberships ?? (t.sort > 4 ? 2 : 1);
          return {
            id,
            full_name: names.get(id) ?? "—",
            title: t.name,
            icon: t.icon,
            done: a?.new_memberships ?? 0,
            required,
            met: a?.met_requirement ?? false,
          };
        })
        .filter((c) => !c.met)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as CoachAtRisk[];
    },
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

