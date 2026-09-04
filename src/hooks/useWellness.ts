import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";

function getErrorMessage(error: unknown): string {
  const e = error as { message?: string; details?: string; hint?: string } | null;
  const raw = (e?.message ?? "").trim();
  // Domain rules raised by the database are already user-safe.
  if (/[.!]$/.test(raw) && raw.length < 160 && !raw.toLowerCase().includes("relation")) return raw;
  const mapped = sanitizeErrorMessage(raw);
  if (mapped !== "Something went wrong. Please try again.") return mapped;
  // Surface the real reason instead of a blank generic message.
  const detail = [raw, e?.details?.trim(), e?.hint?.trim()].filter(Boolean).join(" — ");
  return detail || mapped;
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
  marital_status?: string | null;
  anniversary_date?: string | null;
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
  is_guest?: boolean;
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

/* -------------------------------- Roles -------------------------------- */

/** True when the signed-in user is an admin or manager (can correct/delete records). */
export function useIsWellnessManager() {
  const { data } = useQuery({
    queryKey: ["wellness-manager-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    },
  });
  return data ?? false;
}

/* ------------------------------- Members ------------------------------- */

export function useWellnessMembers(search?: string, status?: WellnessStatus | "all", categoryId?: string | "all") {
  return useQuery({
    queryKey: ["wellness-members", search ?? "", status ?? "all", categoryId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("*, wellness_batches(id, name), member_categories(id, name, direction)")
        .eq("is_guest", false)
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
        .select("*, wellness_batches(id, name), member_categories(id, name, direction)")
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
        await supabase.from("wellness_members").update({ is_guest: false } as never).eq("id", args.memberId);
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
        supabase.from("wellness_members").select("status").eq("is_guest", false),
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

/** Recomputes a member's current weight from the latest remaining reading. */
async function syncCurrentWeight(memberId: string) {
  const { data } = await supabase
    .from("weight_tracking")
    .select("weight")
    .eq("member_id", memberId)
    .order("recorded_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = (data as { weight: number }[] | null)?.[0]?.weight ?? null;
  if (latest != null) {
    await supabase.from("wellness_members").update({ current_weight: latest } as never).eq("id", memberId);
    return;
  }
  const { data: member } = await supabase
    .from("wellness_members")
    .select("initial_weight")
    .eq("id", memberId)
    .maybeSingle();
  await supabase
    .from("wellness_members")
    .update({ current_weight: (member as { initial_weight: number | null } | null)?.initial_weight ?? null } as never)
    .eq("id", memberId);
}

function useProgressInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["weight-tracking"] });
    qc.invalidateQueries({ queryKey: ["body-measurements"] });
    qc.invalidateQueries({ queryKey: ["wellness-members"] });
    qc.invalidateQueries({ queryKey: ["wellness-member"] });
    qc.invalidateQueries({ queryKey: ["member-achievements"] });
  };
}

export function useUpdateWeightEntry() {
  const t = useToastedMutation();
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: async (entry: { id: string; member_id: string; weight: number; recorded_date: string; notes?: string | null }) => {
      const { id, member_id, ...updates } = entry;
      const { error } = await supabase.from("weight_tracking").update(updates as never).eq("id", id);
      if (error) throw error;
      await syncCurrentWeight(member_id);
    },
    onSuccess: () => {
      invalidate();
      t.success("Reading updated");
    },
    onError: t.onError,
  });
}

export function useDeleteWeightEntry() {
  const t = useToastedMutation();
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: async ({ id, member_id }: { id: string; member_id: string }) => {
      const { error } = await supabase.from("weight_tracking").delete().eq("id", id);
      if (error) throw error;
      await syncCurrentWeight(member_id);
    },
    onSuccess: () => {
      invalidate();
      t.success("Reading deleted");
    },
    onError: t.onError,
  });
}

export function useUpdateBodyMeasurement() {
  const t = useToastedMutation();
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("body_measurements").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      t.success("Measurements updated");
    },
    onError: t.onError,
  });
}

export function useDeleteBodyMeasurement() {
  const t = useToastedMutation();
  const invalidate = useProgressInvalidation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("body_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      t.success("Measurements deleted");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Celebrations ------------------------------ */

export interface BirthdayEntry {
  id: string;
  full_name: string;
  mobile_number: string;
  date_of_birth: string;
  nextDate: Date;
  daysAway: number;
  turningAge: number;
}

export interface CelebrationEntry extends BirthdayEntry {
  kind: "birthday" | "anniversary";
  years: number;
}

export function useUpcomingCelebrations(windowDays = 30) {
  return useQuery({
    queryKey: ["wellness-celebrations", windowDays],
    queryFn: async (): Promise<CelebrationEntry[]> => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, date_of_birth, anniversary_date")
        .eq("is_guest", false);
      if (error) throw error;

      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const today = new Date(`${todayStr}T00:00:00`);

      const build = (m: Record<string, unknown>, dateStr: string, kind: "birthday" | "anniversary"): CelebrationEntry => {
        const src = new Date(`${dateStr}T00:00:00`);
        let next = new Date(today.getFullYear(), src.getMonth(), src.getDate());
        if (next < today) next = new Date(today.getFullYear() + 1, src.getMonth(), src.getDate());
        const years = next.getFullYear() - src.getFullYear();
        return {
          id: `${m.id as string}-${kind}`,
          full_name: m.full_name as string,
          mobile_number: m.mobile_number as string,
          date_of_birth: dateStr,
          nextDate: next,
          daysAway: Math.round((next.getTime() - today.getTime()) / 86400000),
          turningAge: years,
          kind,
          years,
        };
      };

      const entries: CelebrationEntry[] = [];
      for (const m of data ?? []) {
        const row = m as Record<string, unknown>;
        if (row.date_of_birth) entries.push(build(row, row.date_of_birth as string, "birthday"));
        if (row.anniversary_date) entries.push(build(row, row.anniversary_date as string, "anniversary"));
      }
      return entries.filter((e) => e.daysAway <= windowDays).sort((a, b) => a.daysAway - b.daysAway);
    },
  });
}

/** Kept for compatibility: birthdays only. */
export function useUpcomingBirthdays(windowDays = 30) {
  const q = useUpcomingCelebrations(windowDays);
  return { ...q, data: q.data?.filter((e) => e.kind === "birthday") };
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
        .select(
          "*, wellness_plans(id, name, price), wellness_members(id, full_name, mobile_number, status, goal, initial_weight, current_weight, is_guest)",
        )
        .eq("status", "active")
        .order("end_date");
      if (error) throw error;
      return data as unknown as (WellnessTrial & {
        plan_id?: string | null;
        wellness_plans?: { id: string; name: string; price: number } | null;
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

/* ---------------------------- Member categories --------------------------- */

export interface MemberCategory {
  id: string;
  name: string;
  slug: string;
  direction: "loss" | "gain";
  active: boolean;
  sort_order: number;
}

export function useMemberCategories(activeOnly = true) {
  return useQuery({
    queryKey: ["member-categories", activeOnly],
    queryFn: async () => {
      let q = supabase.from("member_categories").select("*").order("sort_order");
      if (activeOnly) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as MemberCategory[];
    },
  });
}

export function useSaveMemberCategory() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async ({ id, ...category }: { id?: string } & Record<string, unknown>) => {
      if (id) {
        const { error } = await supabase.from("member_categories").update(category as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_categories").insert(category as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-categories"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      t.success("Category saved");
    },
    onError: t.onError,
  });
}

export function useDeleteMemberCategory() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-categories"] });
      t.success("Category removed");
    },
    onError: t.onError,
  });
}

/* --------------------------- Renewals & switching -------------------------- */

export type RenewMode = "queue" | "extend" | "replace";

export function useRenewPlan() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: {
      membershipId: string;
      planId: string;
      servings?: number | null;
      price?: number | null;
      mode: RenewMode;
      note?: string | null;
    }) => {
      const { error } = await supabase.rpc("renew_membership_v2", {
        p_membership_id: args.membershipId,
        p_plan_id: args.planId,
        p_servings: args.servings ?? null,
        p_price: args.price ?? null,
        p_mode: args.mode,
        p_note: args.note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries();
      t.success(
        vars.mode === "queue"
          ? "Renewal queued — it starts once the current servings run out"
          : vars.mode === "extend"
            ? "Servings added to the current plan"
            : "Plan replaced",
      );
    },
    onError: t.onError,
  });
}

export function useSwitchPlan() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: {
      membershipId: string;
      planId: string;
      carryServings: boolean;
      price?: number | null;
    }) => {
      const { error } = await supabase.rpc("switch_membership_plan", {
        p_membership_id: args.membershipId,
        p_new_plan_id: args.planId,
        p_carry_servings: args.carryServings,
        p_price: args.price ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Plan switched");
    },
    onError: t.onError,
  });
}

/* ---------------------------- Upcoming renewals ---------------------------- */

export function useUpcomingRenewals(servingThreshold = 7, dayThreshold = 7) {
  return useQuery({
    queryKey: ["wellness-upcoming-renewals", servingThreshold, dayThreshold],
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const { data, error } = await supabase
        .from("wellness_memberships")
        .select("*, wellness_plans(id, name), wellness_members(id, full_name, mobile_number)")
        .in("status", ["active", "expiring_soon"])
        .order("remaining_servings");
      if (error) throw error;
      const rows = (data ?? []) as unknown as (WellnessMembership & {
        wellness_members?: { id: string; full_name: string; mobile_number: string } | null;
      })[];
      const todayMs = new Date(`${today}T00:00:00`).getTime();
      return rows
        .map((m) => ({
          ...m,
          daysLeft: Math.round((new Date(`${m.end_date}T00:00:00`).getTime() - todayMs) / 86400000),
        }))
        .filter((m) => m.remaining_servings <= servingThreshold || m.daysLeft <= dayThreshold);
    },
  });
}

/* ------------------------------ Check-in report ---------------------------- */

export interface CheckInReportRow {
  memberId: string;
  name: string;
  visits: number;
  weight: number | null;
  previousWeight: number | null;
  delta: number | null;
  lastVisit: string;
}

export function useCheckInReport(from: string, to: string) {
  return useQuery({
    queryKey: ["wellness-checkin-report", from, to],
    queryFn: async () => {
      const [attendance, weights, requests, definitions, members] = await Promise.all([
        supabase
          .from("wellness_attendance")
          .select("id, member_id, visit_date, visit_time, serving_deducted, wellness_members(id, full_name)")
          .gte("visit_date", from)
          .lte("visit_date", to)
          .order("visit_time", { ascending: false }),
        supabase
          .from("weight_tracking")
          .select("member_id, recorded_date, weight")
          .lte("recorded_date", to)
          .order("recorded_date", { ascending: true }),
        supabase
          .from("wellness_checkin_requests")
          .select("status, request_date")
          .gte("request_date", from)
          .lte("request_date", to),
        supabase.from("achievement_definitions").select("*").eq("is_active", true),
        supabase
          .from("wellness_members")
          .select("id, full_name, initial_weight, current_weight, goal, category_id, member_categories(direction)"),
      ]);
      if (attendance.error) throw attendance.error;
      if (weights.error) throw weights.error;
      if (requests.error) throw requests.error;

      const attRows = (attendance.data ?? []) as unknown as {
        id: string;
        member_id: string;
        visit_date: string;
        visit_time: string;
        serving_deducted: boolean;
        wellness_members?: { id: string; full_name: string } | null;
      }[];

      const weightRows = (weights.data ?? []) as unknown as {
        member_id: string;
        recorded_date: string;
        weight: number;
      }[];

      const byMember: Record<string, CheckInReportRow> = {};
      for (const a of attRows) {
        const key = a.member_id;
        if (!byMember[key]) {
          byMember[key] = {
            memberId: key,
            name: a.wellness_members?.full_name ?? "Member",
            visits: 0,
            weight: null,
            previousWeight: null,
            delta: null,
            lastVisit: a.visit_time,
          };
        }
        byMember[key].visits += 1;
      }

      for (const row of Object.values(byMember)) {
        const history = weightRows.filter((w) => w.member_id === row.memberId);
        const inRange = history.filter((w) => w.recorded_date >= from && w.recorded_date <= to);
        const latest = inRange[inRange.length - 1];
        if (latest) {
          row.weight = Number(latest.weight);
          const before = history.filter((w) => w.recorded_date < latest.recorded_date);
          const prev = before[before.length - 1];
          row.previousWeight = prev ? Number(prev.weight) : null;
          row.delta = prev ? Number((Number(latest.weight) - Number(prev.weight)).toFixed(1)) : null;
        }
      }

      const days: Record<string, number> = {};
      for (const a of attRows) days[a.visit_date] = (days[a.visit_date] ?? 0) + 1;

      const reqRows = (requests.data ?? []) as unknown as { status: string }[];

      // Milestone watch
      const defs = ((definitions.data ?? []) as unknown as {
        id: string;
        category: string;
        name: string;
        threshold: number;
      }[]).filter((d) => d.category === "weight_loss" || d.category === "weight_gain");
      const memberRows = (members.data ?? []) as unknown as {
        id: string;
        full_name: string;
        initial_weight: number | null;
        current_weight: number | null;
        goal: string | null;
        member_categories?: { direction: string } | null;
      }[];

      const milestones: { id: string; name: string; label: string; away: number; achieved: boolean }[] = [];
      for (const m of memberRows) {
        if (!m.initial_weight || !m.current_weight) continue;
        const direction = m.member_categories?.direction ?? (m.goal === "weight_gain" ? "gain" : "loss");
        const delta =
          direction === "gain" ? m.current_weight - m.initial_weight : m.initial_weight - m.current_weight;
        if (delta <= 0) continue;
        const cat = direction === "gain" ? "weight_gain" : "weight_loss";
        const sorted = defs.filter((d) => d.category === cat).sort((a, b) => a.threshold - b.threshold);
        const next = sorted.find((d) => d.threshold > delta);
        const justHit = sorted.filter((d) => d.threshold <= delta).pop();
        if (next && next.threshold - delta <= 1) {
          milestones.push({
            id: m.id,
            name: m.full_name,
            label: next.name,
            away: Number((next.threshold - delta).toFixed(1)),
            achieved: false,
          });
        } else if (justHit && delta - justHit.threshold <= 0.5) {
          milestones.push({ id: m.id, name: m.full_name, label: justHit.name, away: 0, achieved: true });
        }
      }

      return {
        totals: {
          checkins: attRows.length,
          servings: attRows.filter((a) => a.serving_deducted).length,
          uniqueMembers: Object.keys(byMember).length,
          approved: reqRows.filter((r) => r.status === "approved").length,
          rejected: reqRows.filter((r) => r.status === "rejected").length,
          pending: reqRows.filter((r) => r.status === "pending").length,
        },
        days: Object.entries(days)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        members: Object.values(byMember).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)),
        milestones: milestones.sort((a, b) => a.away - b.away),
      };
    },
  });
}


/* ------------------------------ Trials: eligibility & guests ---------------------------- */

export interface TrialCandidate extends WellnessMember {
  blockedReason: string | null;
}

export function useTrialCandidates(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ["wellness-trial-candidates", term],
    enabled: term.length > 1,
    queryFn: async (): Promise<TrialCandidate[]> => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("*")
        .eq("is_guest", false)
        .or(`full_name.ilike.%${term}%,mobile_number.ilike.%${term}%`)
        .limit(10);
      if (error) throw error;
      const members = (data ?? []) as unknown as WellnessMember[];
      if (!members.length) return [];
      const ids = members.map((m) => m.id);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      const [memberships, trials] = await Promise.all([
        supabase
          .from("wellness_memberships")
          .select("member_id, status")
          .in("member_id", ids)
          .in("status", ["active", "expiring_soon", "queued"]),
        supabase
          .from("wellness_trials")
          .select("member_id, end_date")
          .in("member_id", ids)
          .eq("status", "active")
          .gte("end_date", today),
      ]);

      const withPlan = new Set((memberships.data ?? []).map((m) => m.member_id as string));
      const onTrial = new Set((trials.data ?? []).map((t) => t.member_id as string));

      return members.map((m) => ({
        ...m,
        blockedReason: withPlan.has(m.id)
          ? "Already on a membership"
          : onTrial.has(m.id)
            ? "Already on an active trial"
            : null,
      }));
    },
  });
}

export function useStartGuestTrial() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: {
      full_name: string;
      mobile_number: string;
      email?: string | null;
      start_date: string;
      created_by: string;
      duration_days?: number;
    }) => {
      const duration = args.duration_days ?? 3;


      const code = `GT-${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: member, error } = await supabase
        .from("wellness_members")
        .insert({
          full_name: args.full_name.trim(),
          mobile_number: args.mobile_number.trim(),
          email: args.email?.trim() || null,
          joining_date: args.start_date,
          status: "trial",
          is_guest: true,
          activation_code: code,
          created_by: args.created_by,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const { error: e2 } = await supabase.from("wellness_trials").insert({
        member_id: (member as { id: string }).id,
        start_date: args.start_date,
        duration_days: duration,
        status: "active",
        created_by: args.created_by,
      } as never);

      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-trials-active"] });
      qc.invalidateQueries({ queryKey: ["wellness-trial-candidates"] });
      t.success("Guest trial started");
    },
    onError: t.onError,
  });
}
