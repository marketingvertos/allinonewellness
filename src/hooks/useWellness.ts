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
  category_id?: string | null;
  referred_by_member_id?: string | null;
  contact_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  wellness_batches?: { id: string; name: string } | null;
  member_categories?: { id: string; name: string; direction: string } | null;
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
  status: "active" | "expiring_soon" | "expired" | "cancelled" | "queued";
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

export function useWellnessMembers(search?: string, status?: WellnessStatus | "all", categoryId?: string | "all") {
  return useQuery({
    queryKey: ["wellness-members", search ?? "", status ?? "all", categoryId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("*, wellness_batches(id, name), member_categories(id, name, direction)")
        .order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      if (categoryId && categoryId !== "all") q = q.eq("category_id", categoryId);
      if (search)
        q = q.or(
          `full_name.ilike.%${search}%,mobile_number.ilike.%${search}%,activation_code.ilike.%${search}%,email.ilike.%${search}%`,
        );
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
        revenueLast30Days,
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

/* ------------------------- Centre QR / self check-in ------------------------- */

export function useCentreSettings() {
  return useQuery({
    queryKey: ["wellness-centre-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_centre_settings")
        .select("id, checkin_code, code_rotated_at")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { id: string; checkin_code: string; code_rotated_at: string } | null;
    },
  });
}

export function useRotateCheckinCode() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("rotate_checkin_code" as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-centre-settings"] });
      t.success("New QR code generated");
    },
    onError: t.onError,
  });
}

export function useSelfCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { code: string; weight?: number | null }) => {
      const { data, error } = await supabase.rpc("member_self_checkin", {
        p_code: args.code,
        p_weight: args.weight ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as { status: string; message?: string; remaining?: number; mode?: string };
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* --------------------------- Check-in approvals --------------------------- */

export interface CheckInRequest {
  id: string;
  member_id: string;
  membership_id: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  request_date: string;
  requested_at: string;
  reject_reason: string | null;
  requested_weight: number | null;
  wellness_members?: {
    id: string;
    full_name: string;
    mobile_number: string;
    status: string;
    current_weight: number | null;
  } | null;
  wellness_memberships?: {
    id: string;
    remaining_servings: number;
    end_date: string;
  } | null;
}

export function usePendingCheckIns() {
  return useQuery({
    queryKey: ["wellness-checkin-requests", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_checkin_requests")
        .select(
          "*, wellness_members(id, full_name, mobile_number, status, current_weight), wellness_memberships(id, remaining_servings, end_date)",
        )
        .eq("status", "pending")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return data as unknown as CheckInRequest[];
    },
    refetchInterval: 10000,
  });
}

export function useApproveCheckIn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { requestId: string; weight?: number | null }) => {
      const { data, error } = await supabase.rpc("approve_checkin_request", {
        p_request_id: args.requestId,
        p_weight: args.weight ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as { status: string; message?: string; remaining?: number; mode?: string };
    },
    onSuccess: (result) => {
      qc.invalidateQueries();
      if (result?.status === "ok") {
        toast({
          title: "Check-in approved",
          description:
            result.mode === "trial"
              ? "Trial visit recorded."
              : `One serving deducted. ${result.remaining} servings left.`,
        });
      } else {
        toast({
          title: "Not approved",
          description: result?.message ?? "Could not approve this check-in.",
          variant: "destructive",
        });
      }
    },
    onError: (e) =>
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });
}

export function useRejectCheckIn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: { requestId: string; reason?: string }) => {
      const { error } = await supabase.rpc("reject_checkin_request", {
        p_request_id: args.requestId,
        p_reason: args.reason ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast({ title: "Check-in rejected", description: "No serving was deducted." });
    },
    onError: (e) =>
      toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" }),
  });
}

export function useMyCheckInRequest(requestId: string | null) {
  return useQuery({
    queryKey: ["my-checkin-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_checkin_requests")
        .select("*")
        .eq("id", requestId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CheckInRequest | null;
    },
    enabled: !!requestId,
    refetchInterval: (q) =>
      (q.state.data as CheckInRequest | null)?.status === "pending" ? 5000 : false,
  });
}

/* --------------------------- Member portal data --------------------------- */

export function useMyMemberProfile() {
  return useQuery({
    queryKey: ["my-member-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("wellness_members")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WellnessMember | null;
    },
  });
}

/* ------------------------------ Plan admin ------------------------------ */

export function usePlanUsage() {
  return useQuery({
    queryKey: ["wellness-plan-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wellness_plan_usage" as never);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { plan_id: string; usage_count: number }[];
      return Object.fromEntries(rows.map((r) => [r.plan_id, Number(r.usage_count)])) as Record<string, number>;
    },
  });
}

export function useDeleteWellnessPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.rpc("delete_wellness_plan", { p_plan_id: planId } as never);
      if (error) throw error;
      return data as unknown as { status: string; references?: number };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["wellness-plans"] });
      qc.invalidateQueries({ queryKey: ["wellness-plan-usage"] });
      toast({
        title: result?.status === "deleted" ? "Plan deleted" : "Plan deactivated",
        description:
          result?.status === "deleted"
            ? "The plan was never sold, so it has been removed."
            : `The plan is used by ${result?.references ?? 0} record(s), so history was kept and it is now inactive.`,
      });
    },
    onError: (error: unknown) =>
      toast({ title: "Could not remove plan", description: getErrorMessage(error), variant: "destructive" }),
  });
}

/* --------------------------- Body measurements --------------------------- */

export interface BodyMeasurement {
  id: string;
  recorded_date: string;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  body_fat_percentage: number | null;
}

export function useBodyMeasurements(memberId: string | undefined) {
  return useQuery({
    queryKey: ["body-measurements", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, recorded_date, waist, hip, chest, body_fat_percentage")
        .eq("member_id", memberId!)
        .order("recorded_date");
      if (error) throw error;
      return data as unknown as BodyMeasurement[];
    },
    enabled: !!memberId,
  });
}

export function useAddBodyMeasurement() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (entry: Record<string, unknown>) => {
      const { error } = await supabase.from("body_measurements").insert(entry as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body-measurements"] });
      t.success("Measurements recorded");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Birthdays ------------------------------ */

export interface BirthdayEntry {
  id: string;
  full_name: string;
  mobile_number: string;
  date_of_birth: string;
  nextDate: Date;
  daysAway: number;
  turningAge: number;
}

export function useUpcomingBirthdays(windowDays = 30) {
  return useQuery({
    queryKey: ["wellness-birthdays", windowDays],
    queryFn: async (): Promise<BirthdayEntry[]> => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, date_of_birth")
        .not("date_of_birth", "is", null);
      if (error) throw error;

      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const today = new Date(`${todayStr}T00:00:00`);

      return (data ?? [])
        .map((m) => {
          const dob = new Date(`${m.date_of_birth as string}T00:00:00`);
          let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
          const daysAway = Math.round((next.getTime() - today.getTime()) / 86400000);
          return {
            id: m.id as string,
            full_name: m.full_name as string,
            mobile_number: m.mobile_number as string,
            date_of_birth: m.date_of_birth as string,
            nextDate: next,
            daysAway,
            turningAge: next.getFullYear() - dob.getFullYear(),
          };
        })
        .filter((b) => b.daysAway <= windowDays)
        .sort((a, b) => a.daysAway - b.daysAway);
    },
  });
}

/* --------------------- Check-in with optional weight --------------------- */

export function useCheckInWithWeight() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: {
      memberId: string;
      weight?: number | null;
      recordedBy?: string | null;
      method?: string;
      skipCheckIn?: boolean;
    }) => {
      let result: { status: string; message?: string; remaining?: number; mode?: string } | null = null;

      if (!args.skipCheckIn) {
        const { data, error } = await supabase.rpc("checkin_member", {
          p_member_id: args.memberId,
          p_method: args.method ?? "staff_entry",
        } as never);
        if (error) throw error;
        result = data as never;
      }

      if (args.weight && args.recordedBy) {
        const recorded_date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        await supabase
          .from("weight_tracking")
          .delete()
          .eq("member_id", args.memberId)
          .eq("recorded_date", recorded_date);
        const { error } = await supabase.from("weight_tracking").insert({
          member_id: args.memberId,
          weight: args.weight,
          recorded_date,
          recorded_by: args.recordedBy,
        } as never);
        if (error) throw error;
        const { error: e2 } = await supabase
          .from("wellness_members")
          .update({ current_weight: args.weight })
          .eq("id", args.memberId);
        if (e2) throw e2;
      }

      return result;
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries();
      const weightNote = vars.weight ? ` Weight ${vars.weight} kg saved.` : "";
      if (!result) {
        toast({ title: "Weight updated", description: `Today's reading recorded.` });
        return;
      }
      if (result.status === "ok") {
        toast({
          title: "Checked in",
          description:
            (result.mode === "trial" ? "Trial visit recorded." : `Serving used. ${result.remaining} servings left.`) +
            weightNote,
        });
      } else {
        toast({
          title: "Check-in not recorded",
          description: result.message ?? "Please review the member's plan.",
          variant: "destructive",
        });
      }
    },
    onError: (error: unknown) =>
      toast({ title: "Could not save", description: getErrorMessage(error), variant: "destructive" }),
  });
}

/* -------------------------------- Batches -------------------------------- */

export interface WellnessBatch {
  id: string;
  name: string;
  program_type: string | null;
  start_date: string | null;
  end_date: string | null;
  coach_staff_id: string | null;
  max_capacity: number | null;
  status: string;
}

export function useBatches(activeOnly = false) {
  return useQuery({
    queryKey: ["wellness-batches", activeOnly],
    queryFn: async () => {
      let q = supabase.from("wellness_batches").select("*").order("created_at", { ascending: false });
      if (activeOnly) q = q.eq("status", "active");
      const [batches, members] = await Promise.all([
        q,
        supabase.from("wellness_members").select("batch_id").not("batch_id", "is", null),
      ]);
      if (batches.error) throw batches.error;
      const counts: Record<string, number> = {};
      for (const m of members.data ?? []) {
        const key = (m as { batch_id: string }).batch_id;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return (batches.data as unknown as WellnessBatch[]).map((b) => ({ ...b, memberCount: counts[b.id] ?? 0 }));
    },
  });
}

export function useSaveBatch() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id?: string } & Record<string, unknown>) => {
      if (id) {
        const { error } = await supabase.from("wellness_batches").update(values as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wellness_batches").insert(values as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-batches"] });
      t.success("Batch saved");
    },
    onError: t.onError,
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("wellness_members")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", id);
      if ((count ?? 0) > 0) {
        const { error } = await supabase.from("wellness_batches").update({ status: "archived" } as never).eq("id", id);
        if (error) throw error;
        return "archived" as const;
      }
      const { error } = await supabase.from("wellness_batches").delete().eq("id", id);
      if (error) throw error;
      return "deleted" as const;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["wellness-batches"] });
      t.success(result === "deleted" ? "Batch deleted" : "Batch archived (members kept)");
    },
    onError: t.onError,
  });
}

/* ----------------------------- Notifications ----------------------------- */

export interface NotificationTemplate {
  id: string;
  trigger_key: string;
  channel: string;
  message_template: string;
  active: boolean;
}

export interface NotificationLogEntry {
  id: string;
  member_id: string;
  trigger_key: string;
  channel: string;
  message: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  wellness_members?: { id: string; full_name: string; mobile_number: string } | null;
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["wellness-notification-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_notification_templates")
        .select("*")
        .order("trigger_key");
      if (error) throw error;
      return data as unknown as NotificationTemplate[];
    },
  });
}

export function useSaveNotificationTemplate() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id?: string } & Record<string, unknown>) => {
      if (id) {
        const { error } = await supabase
          .from("wellness_notification_templates")
          .update(values as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wellness_notification_templates").insert(values as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-notification-templates"] });
      t.success("Template saved");
    },
    onError: t.onError,
  });
}

export function useDeleteNotificationTemplate() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wellness_notification_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-notification-templates"] });
      t.success("Template removed");
    },
    onError: t.onError,
  });
}

export function useNotificationLog(status: string = "queued") {
  return useQuery({
    queryKey: ["wellness-notification-log", status],
    queryFn: async () => {
      let q = supabase
        .from("wellness_notification_log")
        .select("*, wellness_members(id, full_name, mobile_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as NotificationLogEntry[];
    },
  });
}

export function useMarkNotificationSent() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { id: string; status?: string; error?: string }) => {
      const { error } = await supabase.rpc("mark_notification_sent", {
        p_log_id: args.id,
        p_status: args.status ?? "sent",
        p_error: args.error ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-notification-log"] });
      t.success("Notification updated");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Active trials ----------------------------- */

export function useActiveTrials() {
  return useQuery({
    queryKey: ["wellness-trials-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_trials")
        .select("*, wellness_members(id, full_name, mobile_number, status, goal, initial_weight, current_weight)")
        .eq("status", "active")
        .order("end_date");
      if (error) throw error;
      return data as unknown as (WellnessTrial & {
        wellness_members?: WellnessMember | null;
      })[];
    },
  });
}

/* --------------------------- Serving consumption -------------------------- */

export function useServingTrend(days = 30) {
  return useQuery({
    queryKey: ["wellness-serving-trend", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("visit_date, serving_deducted")
        .gte("visit_date", since.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))
        .order("visit_date");
      if (error) throw error;

      const buckets: Record<string, { visits: number; servings: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        buckets[d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })] = { visits: 0, servings: 0 };
      }
      for (const row of data ?? []) {
        const key = (row as { visit_date: string }).visit_date;
        if (!buckets[key]) buckets[key] = { visits: 0, servings: 0 };
        buckets[key].visits += 1;
        if ((row as { serving_deducted: boolean }).serving_deducted) buckets[key].servings += 1;
      }
      return Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
    },
  });
}

/* ------------------------------- Referrals -------------------------------- */

export function useReferralCounts() {
  return useQuery({
    queryKey: ["wellness-referral-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("referred_by_member_id")
        .not("referred_by_member_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = (row as { referred_by_member_id: string }).referred_by_member_id;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export function useTopReferrers(limit = 10) {
  const counts = useReferralCounts();
  return useQuery({
    queryKey: ["wellness-top-referrers", limit, counts.data],
    enabled: !!counts.data,
    queryFn: async () => {
      const entries = Object.entries(counts.data ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      if (!entries.length) return [] as { id: string; full_name: string; count: number }[];
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, full_name")
        .in("id", entries.map(([id]) => id));
      if (error) throw error;
      const names = Object.fromEntries((data ?? []).map((m) => [m.id as string, m.full_name as string]));
      return entries.map(([id, count]) => ({ id, full_name: names[id] ?? "Member", count }));
    },
  });
}
