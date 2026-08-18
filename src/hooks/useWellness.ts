import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";

function getErrorMessage(error: unknown): string {
  const raw = (error as { message?: string })?.message ?? "";
  // Domain rules raised by the database are already user-safe.
  if (/[.!]$/.test(raw) && raw.length < 160 && !raw.toLowerCase().includes("relation")) return raw;
  return sanitizeErrorMessage(raw);
}

export type WellnessStatus =
  | "lead"
  | "trial"
  | "active_member"
  | "renewal_due"
  | "expired"
  | "inactive";

export interface WellnessMember {
  id: string;
  user_id: string | null;
  full_name: string;
  mobile_number: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  joining_date: string;
  status: WellnessStatus;
  goal: string | null;
  initial_weight: number | null;
  current_weight: number | null;
  target_weight: number | null;
  height: number | null;
  activity_level: string | null;
  batch_id: string | null;
  contact_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  wellness_batches?: { id: string; name: string } | null;
}

export interface WellnessPlan {
  id: string;
  name: string;
  plan_type: string;
  duration_days: number;
  total_servings: number;
  servings_per_day: number;
  price: number;
  description: string | null;
  active: boolean;
}

export interface WellnessMembership {
  id: string;
  member_id: string;
  plan_id: string;
  membership_code: string;
  start_date: string;
  end_date: string;
  total_servings: number;
  used_servings: number;
  remaining_servings: number;
  status: "active" | "expiring_soon" | "expired" | "cancelled";
  price_paid: number;
  wellness_plans?: { id: string; name: string } | null;
}

export interface WellnessTrial {
  id: string;
  member_id: string;
  start_date: string;
  duration_days: number;
  end_date: string;
  weight_at_start: number | null;
  status: "active" | "completed" | "expired" | "converted" | "cancelled";
}

function useToastedMutation() {
  const { toast } = useToast();
  return {
    onError: (error: unknown) =>
      toast({ title: "Something went wrong", description: getErrorMessage(error), variant: "destructive" }),
    success: (title: string) => toast({ title }),
  };
}

/* ------------------------------- Members ------------------------------- */

export function useWellnessMembers(search?: string, status?: WellnessStatus | "all") {
  return useQuery({
    queryKey: ["wellness-members", search ?? "", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("*, wellness_batches(id, name)")
        .order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      if (search) q = q.or(`full_name.ilike.%${search}%,mobile_number.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as WellnessMember[];
    },
  });
}

export function useWellnessMember(id: string | undefined) {
  return useQuery({
    queryKey: ["wellness-member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("*, wellness_batches(id, name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WellnessMember | null;
    },
    enabled: !!id,
  });
}

export function useCreateWellnessMember() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (member: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("wellness_members")
        .insert(member as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      t.success("Member added");
    },
    onError: t.onError,
  });
}

export function useUpdateWellnessMember() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("wellness_members")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      qc.invalidateQueries({ queryKey: ["wellness-member"] });
      t.success("Member updated");
    },
    onError: t.onError,
  });
}

/* -------------------------------- Plans -------------------------------- */

export function useWellnessPlans(activeOnly = true) {
  return useQuery({
    queryKey: ["wellness-plans", activeOnly],
    queryFn: async () => {
      let q = supabase.from("wellness_plans").select("*").order("price");
      if (activeOnly) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as WellnessPlan[];
    },
  });
}

export function useSaveWellnessPlan() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async ({ id, ...plan }: { id?: string } & Record<string, unknown>) => {
      if (id) {
        const { error } = await supabase.from("wellness_plans").update(plan as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wellness_plans").insert(plan as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-plans"] });
      t.success("Plan saved");
    },
    onError: t.onError,
  });
}

/* ------------------------- Trials & memberships ------------------------- */

export function useMemberTrials(memberId: string | undefined) {
  return useQuery({
    queryKey: ["wellness-trials", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_trials")
        .select("*")
        .eq("member_id", memberId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as WellnessTrial[];
    },
    enabled: !!memberId,
  });
}

export function useMemberships(memberId: string | undefined) {
  return useQuery({
    queryKey: ["wellness-memberships", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_memberships")
        .select("*, wellness_plans(id, name)")
        .eq("member_id", memberId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as WellnessMembership[];
    },
    enabled: !!memberId,
  });
}

export function useActiveMemberships() {
  return useQuery({
    queryKey: ["wellness-memberships-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_memberships")
        .select("*, wellness_plans(id, name), wellness_members(id, full_name, mobile_number)")
        .in("status", ["active", "expiring_soon"])
        .order("end_date");
      if (error) throw error;
      return data as unknown as (WellnessMembership & {
        wellness_members?: { id: string; full_name: string; mobile_number: string } | null;
      })[];
    },
  });
}

export function useStartTrial() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (trial: Record<string, unknown>) => {
      const { error } = await supabase.from("wellness_trials").insert(trial as never);
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("wellness_members")
        .update({ status: "trial" })
        .eq("id", trial.member_id as string);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-trials"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      t.success("Trial started");
    },
    onError: t.onError,
  });
}

export function useCreateMembership() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { memberId: string; planId: string; price?: number; trialId?: string }) => {
      if (args.trialId) {
        const { error } = await supabase.rpc("convert_trial_to_membership", {
          p_trial_id: args.trialId,
          p_plan_id: args.planId,
          p_price: args.price ?? null,
        } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("create_membership", {
          p_member_id: args.memberId,
          p_plan_id: args.planId,
          p_price: args.price ?? null,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Membership activated");
    },
    onError: t.onError,
  });
}

export function useRenewMembership() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { membershipId: string; planId?: string; price?: number }) => {
      const { error } = await supabase.rpc("renew_membership", {
        p_membership_id: args.membershipId,
        p_plan_id: args.planId ?? null,
        p_price: args.price ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Membership renewed");
    },
    onError: t.onError,
  });
}

export function useAdjustServings() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { membershipId: string; change: number; note?: string }) => {
      const { error } = await supabase.rpc("adjust_servings", {
        p_membership_id: args.membershipId,
        p_change: args.change,
        p_note: args.note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Servings adjusted");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Attendance ------------------------------ */

export function useTodayAttendance() {
  return useQuery({
    queryKey: ["wellness-attendance-today"],
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("*, wellness_members(id, full_name, mobile_number)")
        .eq("visit_date", today)
        .order("visit_time", { ascending: false });
      if (error) throw error;
      return data as unknown as {
        id: string;
        member_id: string;
        visit_time: string;
        serving_deducted: boolean;
        remaining_balance_snapshot: number | null;
        checkin_method: string;
        wellness_members?: { id: string; full_name: string; mobile_number: string } | null;
      }[];
    },
  });
}

export function useMemberAttendance(memberId: string | undefined) {
  return useQuery({
    queryKey: ["wellness-attendance", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("*")
        .eq("member_id", memberId!)
        .order("visit_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as unknown as {
        id: string;
        visit_date: string;
        visit_time: string;
        serving_deducted: boolean;
        remaining_balance_snapshot: number | null;
        checkin_method: string;
      }[];
    },
    enabled: !!memberId,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { memberId: string; method?: string }) => {
      const { data, error } = await supabase.rpc("checkin_member", {
        p_member_id: args.memberId,
        p_method: args.method ?? "staff_entry",
      } as never);
      if (error) throw error;
      return data as unknown as { status: string; message?: string; remaining?: number; mode?: string };
    },
    onSuccess: (result) => {
      qc.invalidateQueries();
      if (result?.status === "ok") {
        toast({
          title: "Checked in",
          description:
            result.mode === "trial"
              ? "Trial visit recorded."
              : `Serving used. ${result.remaining} servings left.`,
        });
      } else {
        toast({
          title: "Check-in not recorded",
          description: result?.message ?? "Please review the member's plan.",
          variant: "destructive",
        });
      }
    },
    onError: (error: unknown) =>
      toast({ title: "Check-in failed", description: getErrorMessage(error), variant: "destructive" }),
  });
}

/* ----------------------------- Servings log ----------------------------- */

export function useServingLedger(memberId: string | undefined) {
  return useQuery({
    queryKey: ["serving-ledger", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("serving_transactions")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as {
        id: string;
        txn_type: string;
        change: number;
        balance_after: number;
        note: string | null;
        created_at: string;
      }[];
    },
    enabled: !!memberId,
  });
}

/* ------------------------------- Progress ------------------------------- */

export function useWeightHistory(memberId: string | undefined) {
  return useQuery({
    queryKey: ["weight-tracking", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_tracking")
        .select("*")
        .eq("member_id", memberId!)
        .order("recorded_date");
      if (error) throw error;
      return data as unknown as {
        id: string;
        recorded_date: string;
        weight: number;
        notes: string | null;
      }[];
    },
    enabled: !!memberId,
  });
}

export function useAddWeight() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (entry: { member_id: string; weight: number; recorded_date: string; recorded_by: string; notes?: string | null }) => {
      const { error } = await supabase.from("weight_tracking").insert(entry as never);
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("wellness_members")
        .update({ current_weight: entry.weight })
        .eq("id", entry.member_id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-tracking"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      qc.invalidateQueries({ queryKey: ["wellness-member"] });
      t.success("Weight recorded");
    },
    onError: t.onError,
  });
}

/* -------------------------------- Notes -------------------------------- */

export function useMemberNotes(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-notes", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_notes")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as { id: string; note: string; created_at: string }[];
    },
    enabled: !!memberId,
  });
}

export function useAddMemberNote() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (entry: { member_id: string; note: string; created_by: string }) => {
      const { error } = await supabase.from("member_notes").insert(entry as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-notes"] });
      t.success("Note added");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Dashboard ------------------------------ */

export function useWellnessStats() {
  return useQuery({
    queryKey: ["wellness-stats"],
    queryFn: async () => {
      await supabase.rpc("refresh_wellness_statuses" as never);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      const [members, checkins, memberships, lowBalance] = await Promise.all([
        supabase.from("wellness_members").select("status"),
        supabase.from("wellness_attendance").select("id", { count: "exact", head: true }).eq("visit_date", today),
        supabase.from("wellness_memberships").select("status, end_date, remaining_servings, price_paid, start_date"),
        supabase
          .from("wellness_memberships")
          .select("id, remaining_servings, member_id, end_date, wellness_members(full_name, mobile_number)")
          .in("status", ["active", "expiring_soon"])
          .lte("remaining_servings", 5)
          .order("remaining_servings"),
      ]);

      if (members.error) throw members.error;
      if (memberships.error) throw memberships.error;

      const statusCounts = (members.data ?? []).reduce<Record<string, number>>((acc, m) => {
        acc[m.status as string] = (acc[m.status as string] ?? 0) + 1;
        return acc;
      }, {});

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const revenueLast30Days = (memberships.data ?? [])
        .filter((m) => new Date(m.start_date as string) >= since)
        .reduce((sum, m) => sum + Number(m.price_paid ?? 0), 0);

      return {
        totalMembers: members.data?.length ?? 0,
        statusCounts,
        checkinsToday: checkins.count ?? 0,
        activeMemberships: (memberships.data ?? []).filter((m) => m.status === "active").length,
        renewalsDue: (memberships.data ?? []).filter((m) => m.status === "expiring_soon").length,
        revenueThisMonth,
        lowBalance: (lowBalance.data ?? []) as unknown as {
          id: string;
          member_id: string;
          remaining_servings: number;
          end_date: string;
          wellness_members?: { full_name: string; mobile_number: string } | null;
        }[],
      };
    },
  });
}
