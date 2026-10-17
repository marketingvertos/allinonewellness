import { buildSales, summarise, type LedgerPayment, type LegacySale, type Sale } from "@/lib/salesLedger";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { ensureMemberLogin } from "@/hooks/useMemberAccess";
import { todayIst } from "@/lib/formatters";

/** Read every page of a query; the API caps each response at 1,000 rows. */
async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: all, error: null };
  }
}

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
  is_guest: boolean;
  member_mode: string;
  tags: string[];
  pink_card_balance: number;
  frontline_count: number;
  cluster_count: number;
  network_total: number;
  master_level: number;
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

/** True only for full admin accounts (super admins) — used for destructive actions. */
export function useIsWellnessAdmin() {
  const { data } = useQuery({
    queryKey: ["wellness-admin-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return (roles ?? []).some((r) => r.role === "admin");
    },
  });
  return data ?? false;
}

/* ------------------------------- Members ------------------------------- */

export type MemberModeFilter = "all" | "physical" | "virtual";

/** Member ids for a mode filter, or null when no filtering is needed. */
async function memberIdsForMode(mode: MemberModeFilter | undefined): Promise<string[] | null> {
  if (!mode || mode === "all") return null;
  const { data, error } = await supabase
    .from("wellness_members")
    .select("id")
    .eq("member_mode", mode);
  if (error) throw error;
  return (data ?? []).map((m) => m.id as string);
}

export function useWellnessMembers(
  search?: string,
  status?: WellnessStatus | "all",
  categoryId?: string | "all",
  memberMode?: MemberModeFilter,
  tag?: string | "all",
) {
  return useQuery({
    queryKey: [
      "wellness-members",
      search ?? "",
      status ?? "all",
      categoryId ?? "all",
      memberMode ?? "all",
      tag ?? "all",
    ],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("*, wellness_batches(id, name), member_categories(id, name, direction)")
        .eq("is_guest", false)
        .order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      if (categoryId && categoryId !== "all") q = q.eq("category_id", categoryId);
      if (memberMode && memberMode !== "all") q = q.eq("member_mode", memberMode);
      if (tag && tag !== "all") q = q.contains("tags", [tag]);
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
      qc.invalidateQueries({ queryKey: ["referral-network"] });
      qc.invalidateQueries({ queryKey: ["network-summary"] });
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
      // Moving off "lead" means they now need portal access.
      if (typeof updates.status === "string" && updates.status !== "lead") {
        await ensureMemberLogin(id);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      qc.invalidateQueries({ queryKey: ["referral-network"] });
      qc.invalidateQueries({ queryKey: ["network-summary"] });
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

export function useActiveMemberships(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-memberships-active", memberMode ?? "all"],
    queryFn: async () => {
      const ids = await memberIdsForMode(memberMode);
      let query = supabase
        .from("wellness_memberships")
        .select("*, wellness_plans(id, name), wellness_members(id, full_name, mobile_number)")
        .in("status", ["active", "expiring_soon"])
        .order("end_date");
      if (ids) query = query.in("member_id", ids);
      const { data, error } = await query;
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
      await ensureMemberLogin(trial.member_id as string);
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
    mutationFn: async (args: {
      memberId: string;
      planId: string;
      price?: number;
      trialId?: string;
      paymentMode?: string;
      paymentDate?: string;
    }) => {
      let membershipId: string | null = null;
      if (args.trialId) {
        await supabase.from("wellness_members").update({ is_guest: false } as never).eq("id", args.memberId);
        const { data, error } = await supabase.rpc("convert_trial_to_membership", {
          p_trial_id: args.trialId,
          p_plan_id: args.planId,
          p_price: args.price ?? null,
        } as never);
        if (error) throw error;
        membershipId = (data as unknown as string) ?? null;
      } else {
        const { data, error } = await supabase.rpc("create_membership", {
          p_member_id: args.memberId,
          p_plan_id: args.planId,
          p_price: args.price ?? null,
        } as never);
        if (error) throw error;
        membershipId = (data as unknown as string) ?? null;
      }
      // A paying member must always be able to sign in — leads registered
      // through the public form have no login until this point.
      await ensureMemberLogin(args.memberId);
      if (membershipId && (args.paymentMode || args.paymentDate)) {
        await supabase
          .from("wellness_memberships")
          .update({
            payment_mode: args.paymentMode ?? "cash",
            payment_date: args.paymentDate ?? null,
          } as never)
          .eq("id", membershipId);
      }
      return membershipId;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Membership activated");
    },
    onError: t.onError,
  });
}

/* ------------------------------ Payments ------------------------------ */

export interface WellnessPayment {
  id: string;
  membership_id: string;
  member_id: string;
  amount: number;
  mode: string;
  reference: string | null;
  note: string | null;
  context: string;
  paid_at: string;
  created_at: string;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      membershipId: string;
      memberId: string;
      payments: { amount: number; mode: string; reference?: string }[];
      context?: string;
      paidOn?: string | null;
    }) => {
      if (args.payments.length === 0) return;
      const { error } = await supabase.rpc("record_payment", {
        p_membership_id: args.membershipId,
        p_member_id: args.memberId,
        p_payments: args.payments,
        p_context: args.context ?? "activation",
        p_paid_on: args.paidOn ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-payments"] });
      qc.invalidateQueries({ queryKey: ["wellness-memberships"] });
    },
  });
}

export function usePaymentHistory(membershipId: string | undefined) {
  return useQuery({
    queryKey: ["wellness-payments", membershipId],
    enabled: !!membershipId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_payments")
        .select("*")
        .eq("membership_id", membershipId!)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WellnessPayment[];
    },
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

/** Admin correction of an existing membership (plan, dates, payment, servings). */
export function useUpdateMembership() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: {
      membershipId: string;
      planId?: string;
      startDate?: string;
      endDate?: string;
      totalServings?: number;
      remainingServings?: number;
      price?: number;
      paymentMode?: string;
      paymentDate?: string;
    }) => {
      const { error } = await supabase.rpc("admin_update_membership", {
        p_membership_id: args.membershipId,
        p_plan_id: args.planId ?? null,
        p_start_date: args.startDate ?? null,
        p_end_date: args.endDate ?? null,
        p_total_servings: args.totalServings ?? null,
        p_remaining_servings: args.remainingServings ?? null,
        p_price: args.price ?? null,
        p_payment_mode: args.paymentMode ?? null,
        p_payment_date: args.paymentDate ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Membership updated");
    },
    onError: t.onError,
  });
}

export function useIssueServings() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { membershipId: string; quantity: number; reason?: string; dates?: string[] }) => {
      const { error } = await supabase.rpc("issue_servings", {
        p_membership_id: args.membershipId,
        p_quantity: args.quantity,
        p_reason: args.reason ?? "Packed for member",
        p_dates: args.dates?.length ? args.dates : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Servings issued");
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

export function useTodayAttendance(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-attendance-today", memberMode ?? "all"],
    queryFn: async () => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const ids = await memberIdsForMode(memberMode);
      let q = supabase
        .from("wellness_attendance")
        .select("*, wellness_members(id, full_name, mobile_number)")
        .eq("visit_date", today)
        .neq("checkin_method", "serving_issue" as never)
        .order("visit_time", { ascending: false });
      if (ids) q = q.in("member_id", ids);
      const { data, error } = await q;
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
      const rows = (data ?? []) as unknown as {
        id: string;
        txn_type: string;
        change: number;
        balance_after: number;
        note: string | null;
        created_at: string;
        created_by: string | null;
      }[];

      const staffIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (staffIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", staffIds);
        for (const p of profiles ?? []) {
          if (p.full_name) names.set(p.user_id, p.full_name);
        }
      }

      const packIds = rows.filter((r) => r.txn_type === "pack_and_issue").map((r) => r.id);
      const datesByTxn = new Map<string, string[]>();
      if (packIds.length) {
        const { data: att } = await supabase
          .from("wellness_attendance")
          .select("serving_txn_id, visit_date")
          .in("serving_txn_id" as never, packIds as never)
          .order("visit_date");
        for (const a of (att ?? []) as unknown as { serving_txn_id: string; visit_date: string }[]) {
          const list = datesByTxn.get(a.serving_txn_id) ?? [];
          list.push(a.visit_date);
          datesByTxn.set(a.serving_txn_id, list);
        }
      }

      return rows.map((r) => ({
        ...r,
        created_by_name: r.created_by ? names.get(r.created_by) ?? null : null,
        covered_dates: datesByTxn.get(r.id) ?? [],
      }));
    },
    enabled: !!memberId,
  });
}

export function useEditServingDates() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { txnId: string; dates: string[]; freed: string[] }) => {
      const { error } = await supabase.rpc("edit_serving_dates" as never, {
        p_txn_id: args.txnId,
        p_dates: args.dates,
      } as never);
      if (error) throw error;
      return args.freed;
    },
    onSuccess: (freed) => {
      qc.invalidateQueries();
      const fmt = (d: string) =>
        new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      t.success(
        freed.length
          ? `Dates updated. ${freed.map(fmt).join(", ")} ${freed.length === 1 ? "is" : "are"} now free for check-in.`
          : "Dates updated",
      );
    },
    onError: t.onError,
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

export function useWellnessStats(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-stats", memberMode ?? "all"],
    queryFn: async () => {
      await supabase.rpc("refresh_wellness_statuses" as never);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const ids = await memberIdsForMode(memberMode);

      let membersQ = supabase.from("wellness_members").select("status").eq("is_guest", false);
      let checkinsQ = supabase
        .from("wellness_attendance")
        .select("id", { count: "exact", head: true })
        .eq("visit_date", today)
        .neq("checkin_method", "serving_issue" as never);
      let membershipsQ = supabase
        .from("wellness_memberships")
        .select("status, end_date, remaining_servings, price_paid, start_date");
      let lowBalanceQ = supabase
        .from("wellness_memberships")
        .select("id, remaining_servings, member_id, end_date, wellness_members(full_name, mobile_number)")
        .in("status", ["active", "expiring_soon"])
        .lte("remaining_servings", 5)
        .order("remaining_servings");
      if (ids) {
        membersQ = membersQ.in("id", ids);
        checkinsQ = checkinsQ.in("member_id", ids);
        membershipsQ = membershipsQ.in("member_id", ids);
        lowBalanceQ = lowBalanceQ.in("member_id", ids);
      }

      const [members, checkins, memberships, lowBalance] = await Promise.all([
        membersQ,
        checkinsQ,
        membershipsQ,
        lowBalanceQ,
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

export function usePendingCheckIns(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-checkin-requests", "pending", memberMode ?? "all"],
    queryFn: async () => {
      const ids = await memberIdsForMode(memberMode);
      let q = supabase
        .from("wellness_checkin_requests")
        .select(
          "*, wellness_members(id, full_name, mobile_number, status, current_weight), wellness_memberships(id, remaining_servings, end_date)",
        )
        .eq("status", "pending")
        .order("requested_at", { ascending: true });
      if (ids) q = q.in("member_id", ids);
      const { data, error } = await q;
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
        runNotificationsNow();
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

export interface OnlinePaymentRow {
  id: string;
  amount_paise: number;
  pink_credits: number;
  status: string;
  created_at: string;
}

/** Razorpay payments a member made from the portal. */
export function useMyOnlinePayments(memberId: string | undefined) {
  return useQuery({
    queryKey: ["my-online-payments", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("razorpay_orders")
        .select("id, amount_paise, pink_credits, status, created_at")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OnlinePaymentRow[];
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
  weight: number | null;
  trunk_fat: number | null;
  muscle_mass: number | null;
  visceral_fat: number | null;
  bmr: number | null;
  bmi: number | null;
  body_age: number | null;
  ideal_weight: number | null;
  remark: string | null;
}

export function useBodyMeasurements(memberId: string | undefined) {
  return useQuery({
    queryKey: ["body-measurements", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("*")
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

export function useUpcomingCelebrations(windowDays = 30, memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-celebrations", windowDays, memberMode ?? "all"],
    queryFn: async (): Promise<CelebrationEntry[]> => {
      let q = supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, date_of_birth, anniversary_date")
        .eq("is_guest", false);
      if (memberMode && memberMode !== "all") q = q.eq("member_mode", memberMode);
      const { data, error } = await q;
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
export function useUpcomingBirthdays(windowDays = 30, memberMode?: MemberModeFilter) {
  const q = useUpcomingCelebrations(windowDays, memberMode);
  return { ...q, data: q.data?.filter((e) => e.kind === "birthday") };
}

/* --------------------- Check-in with optional weight --------------------- */

/** Nudge the WhatsApp queue so the confirmation goes out immediately (cron is the fallback). */
function runNotificationsNow() {
  void supabase.functions.invoke("whatsapp-notification-runner", { body: { source: "checkin" } }).catch(() => {});
}


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
        runNotificationsNow();
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
  template_name: string | null;
  template_language: string | null;
  variables: string[] | null;
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

export function useActiveTrials(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-trials-active", memberMode ?? "all"],
    queryFn: async () => {
      const ids = await memberIdsForMode(memberMode);
      let q = supabase
        .from("wellness_trials")
        .select(
          "*, wellness_plans(id, name, price), wellness_members(id, full_name, mobile_number, status, goal, initial_weight, current_weight, is_guest)",
        )
        .eq("status", "active")
        .order("end_date");
      if (ids) q = q.in("member_id", ids);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as (WellnessTrial & {
        plan_id?: string | null;
        wellness_plans?: { id: string; name: string; price: number } | null;
        wellness_members?: WellnessMember | null;
      })[];
    },
  });
}


/** Trials that ended in the last 30 days where the person has not joined yet. */
export function useRecentEndedTrials() {
  return useQuery({
    queryKey: ["wellness-trials-active", "ended"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const { data, error } = await supabase
        .from("wellness_trials")
        .select("*, wellness_plans(id, name, price), wellness_members(id, full_name, mobile_number, status, goal, initial_weight, current_weight, is_guest)")
        .in("status", ["expired", "completed"])
        .gte("end_date", since)
        .order("end_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (WellnessTrial & { wellness_members?: WellnessMember | null })[];
      if (!rows.length) return rows;
      const { data: ms } = await supabase
        .from("wellness_memberships")
        .select("member_id")
        .in("member_id", rows.map((r) => r.member_id))
        .in("status", ["active", "expiring_soon", "queued"]);
      const joined = new Set((ms ?? []).map((m) => m.member_id));
      const seen = new Set<string>();
      return rows.filter((r) => !joined.has(r.member_id) && !seen.has(r.member_id) && seen.add(r.member_id));
    },
  });
}

/* --------------------------- Serving consumption -------------------------- */

export function useServingTrend(days = 30, memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-serving-trend", days, memberMode ?? "all"],
    queryFn: async () => {
      const today = todayIst();
      const shift = (n: number) =>
        new Date(Date.parse(today + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
      const since = shift(-(days - 1));
      const ids = await memberIdsForMode(memberMode);
      const memberFilter = ids ? (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : null;
      // Club check-ins: every visit at the club (trial, guest or membership), excluding packed days.
      const att = await readAllPages<{ visit_date: string }>((a, b) => {
        let q = supabase
          .from("wellness_attendance")
          .select("visit_date")
          .neq("checkin_method", "serving_issue" as never)
          .gte("visit_date", since)
          .lte("visit_date", today)
          .order("id")
          .range(a, b);
        if (memberFilter) q = q.in("member_id", memberFilter);
        return q;
      });
      if (att.error) throw att.error;
      // Servings issued: packed quantity counted on the day it was handed over.
      const packs = await readAllPages<{ change: number; created_at: string }>((a, b) => {
        let q = supabase
          .from("serving_transactions")
          .select("change, created_at")
          .eq("txn_type", "pack_and_issue" as never)
          .gte("created_at", `${since}T00:00:00+05:30`)
          .lte("created_at", `${today}T23:59:59.999+05:30`)
          .order("id")
          .range(a, b);
        if (memberFilter) q = q.in("member_id", memberFilter);
        return q;
      });
      if (packs.error) throw packs.error;
      // WLP evening session check-ins, counted on the session date.
      const wlp = await readAllPages<{ wlp_sessions: { session_date: string } | null }>((a, b) => {
        let q = supabase
          .from("wlp_checkins")
          .select("wlp_sessions!inner(session_date)")
          .gte("wlp_sessions.session_date", since)
          .lte("wlp_sessions.session_date", today)
          .order("id")
          .range(a, b);
        if (memberFilter) q = q.in("member_id", memberFilter);
        return q as never;
      });
      if (wlp.error) throw wlp.error;

      const buckets: Record<string, { club: number; issued: number; wlp: number }> = {};
      for (let i = days - 1; i >= 0; i--) buckets[shift(-i)] = { club: 0, issued: 0, wlp: 0 };
      for (const w of wlp.data) {
        const d = w.wlp_sessions?.session_date;
        if (d && buckets[d]) buckets[d].wlp += 1;
      }
      for (const row of att.data) if (buckets[row.visit_date]) buckets[row.visit_date].club += 1;
      for (const p of packs.data) {
        const key = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        if (buckets[key]) buckets[key].issued += Math.abs(Number(p.change));
      }
      return Object.entries(buckets).map(([date, v]) => ({ date, ...v, total: v.club + v.issued + v.wlp }));
    },
  });
}

/* ------------------------------- Referrals -------------------------------- */

export function useReferralCounts(memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-referral-counts", memberMode ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("wellness_members")
        .select("referred_by_member_id")
        .not("referred_by_member_id", "is", null);
      if (memberMode && memberMode !== "all") q = q.eq("member_mode", memberMode);
      const { data, error } = await q;
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

export function useTopReferrers(limit = 10, memberMode?: MemberModeFilter) {
  const counts = useReferralCounts(memberMode);
  return useQuery({
    queryKey: ["wellness-top-referrers", limit, memberMode ?? "all", counts.data],
    enabled: !!counts.data,
    queryFn: async () => {
      const entries = Object.entries(counts.data ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      if (!entries.length) return [] as { id: string; full_name: string; count: number; tags: string[] }[];
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, full_name, tags")
        .in("id", entries.map(([id]) => id));
      if (error) throw error;
      const byId = Object.fromEntries((data ?? []).map((m) => [m.id as string, m]));
      return entries.map(([id, count]) => ({
        id,
        full_name: (byId[id]?.full_name as string) ?? "Member",
        tags: ((byId[id]?.tags as string[] | null) ?? []),
        count,
      }));
    },

  });
}

/* --------------------------- Master title network ------------------------- */

export const MASTER_LEVELS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 15, 10] as const;

export function getMasterTitle(totalNetwork: number): string | null {
  for (const level of MASTER_LEVELS) {
    if (totalNetwork >= level) return `Master ${level}`;
  }
  return null;
}

export function getNextMasterLevel(totalNetwork: number): { level: number; remaining: number } | null {
  const levels = [...MASTER_LEVELS].reverse();
  for (const level of levels) {
    if (totalNetwork < level) return { level, remaining: level - totalNetwork };
  }
  return null;
}

export interface NetworkMember {
  member_id: string;
  full_name: string;
  mobile_number?: string;
  status: string;
  depth: number;
  referred_by: string | null;
  qualifies_this_month?: boolean;
  plan_name?: string | null;
  plan_type?: string | null;
  duration_days?: number | null;
  total_servings?: number | null;
  membership_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  remaining_servings?: number | null;
}

/** Own-network tree with plan details. Members can only load their own network (enforced server-side). */
export function useMemberNetwork(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member-network", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_network" as never, { p_member_id: memberId! } as never);
      if (error) throw error;
      return (data ?? []) as unknown as NetworkMember[];
    },
    enabled: !!memberId,
  });
}

export function useReferralNetwork(memberId: string | undefined) {
  return useQuery({
    queryKey: ["referral-network", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_referral_network", {
        root_member_id: memberId!,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as NetworkMember[];
    },
    enabled: !!memberId,
  });
}

export interface SupervisorStatus {
  month: string;
  is_supervisor: boolean;
  self_renewed: boolean;
  new_frontline_count: number;
  new_frontline_required: number;
  qualifying_frontline: number;
  qualifying_network_total: number;
  master_level: number;
  is_qualified: boolean;
}

export function useSupervisorStatus(memberId: string | undefined) {
  return useQuery({
    queryKey: ["supervisor-status", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_supervisor_status", {
        p_member_id: memberId!,
      } as never);
      if (error) throw error;
      return data as unknown as SupervisorStatus;
    },
    enabled: !!memberId,
  });
}


export interface NetworkSummary {
  root_id: string;
  frontline_count: number;
  cluster_count: number;
  total_count: number;
  master_level: number;
}

export function useNetworkSummary(memberIds: string[]) {
  const key = [...memberIds].sort().join(",");
  return useQuery({
    queryKey: ["network-summary", key],
    queryFn: async () => {
      if (!memberIds.length) return [] as NetworkSummary[];
      const { data, error } = await supabase.rpc("get_network_summary", {
        member_ids: memberIds,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as NetworkSummary[];
    },
    enabled: memberIds.length > 0,
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
      paymentMode?: string;
      paymentDate?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("renew_membership_v2", {
        p_membership_id: args.membershipId,
        p_plan_id: args.planId,
        p_servings: args.servings ?? null,
        p_price: args.price ?? null,
        p_mode: args.mode,
        p_note: args.note ?? null,
        p_payment_mode: args.paymentMode ?? "cash",
        p_payment_date: args.paymentDate ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as string) ?? args.membershipId) as string;
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
      const { data, error } = await supabase.rpc("switch_membership_plan", {
        p_membership_id: args.membershipId,
        p_new_plan_id: args.planId,
        p_carry_servings: args.carryServings,
        p_price: args.price ?? null,
      } as never);
      if (error) throw error;
      return ((data as unknown as string) ?? args.membershipId) as string;
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
        readAllPages((a, b) =>
          supabase
            .from("wellness_attendance")
            .select("id, member_id, visit_date, visit_time, serving_deducted, wellness_members(id, full_name)")
            .neq("checkin_method", "serving_issue" as never)
            .gte("visit_date", from)
            .lte("visit_date", to)
            .order("visit_time", { ascending: false })
            .order("id")
            .range(a, b),
        ),
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
      height?: number | null;
      weight?: number | null;
      referred_by_member_id?: string | null;
      referrer_name?: string | null;
      referrer_mobile?: string | null;
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
          height: args.height ?? null,
          initial_weight: args.weight ?? null,
          current_weight: args.weight ?? null,
          referred_by_member_id: args.referred_by_member_id ?? null,
          created_by: args.created_by,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const memberId = (member as { id: string }).id;

      const { data: trialRow, error: e2 } = await supabase.from("wellness_trials").insert({
        member_id: memberId,
        start_date: args.start_date,
        duration_days: duration,
        status: "active",
        weight_at_start: args.weight ?? null,
        created_by: args.created_by,
      } as never).select("id").single();

      if (e2) throw e2;

      // Day one is the walk-in visit: record it automatically (not for future start dates).
      const todayIstStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (args.start_date <= todayIstStr) {
        await supabase.rpc("mark_trial_attendance" as never, {
          p_trial_id: (trialRow as { id: string }).id,
          p_date: args.start_date,
        } as never);
      }

      if (args.weight != null) {
        await supabase.from("weight_tracking").insert({
          member_id: memberId,
          recorded_date: args.start_date,
          weight: args.weight,
          notes: "Guest trial start",
          recorded_by: args.created_by,
        } as never);
      }

      // Referrer who is not on the member list is kept as a note on the guest.
      const outsideName = args.referrer_name?.trim();
      if (!args.referred_by_member_id && outsideName) {
        const phone = args.referrer_mobile?.trim();
        await supabase.from("member_notes").insert({
          member_id: memberId,
          note: `Referred by / helped by: ${outsideName}${phone ? ` · ${phone}` : ""} (not a club member)`,
          created_by: args.created_by,
        } as never);
      }


      let loginError: string | null = null;
      try {
        await ensureMemberLogin(memberId);
      } catch (err) {
        loginError = (err as Error).message || "Could not create the guest login.";
      }

      return { memberId, loginError };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-trials-active"] });
      qc.invalidateQueries({ queryKey: ["wellness-trial-candidates"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      t.success("Guest trial started");
    },
    onError: t.onError,
  });
}


/* --------------------------- Sales & servings analytics -------------------------- */

export interface PeriodRange {
  from: string;
  to: string;
}

function istDateStr(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Named periods resolved to IST date ranges. */
export function periodRange(period: "today" | "week" | "month" | "last_month" | "last30"): PeriodRange {
  const today = istDateStr(new Date());
  const [y, m, d] = today.split("-").map(Number);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const dow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7; // Monday = 0
    const start = new Date(`${today}T00:00:00`);
    start.setDate(start.getDate() - dow);
    return { from: istDateStr(start), to: today };
  }
  if (period === "month") {
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
  }
  if (period === "last_month") {
    const first = new Date(Date.UTC(y, m - 2, 1));
    const last = new Date(Date.UTC(y, m - 1, 0));
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  const start = new Date(`${today}T00:00:00`);
  start.setDate(start.getDate() - 29);
  return { from: istDateStr(start), to: today };
}

export interface SalesSummary {
  memberships: number;
  revenue: number;
  servings: number;
  /** Revenue split: new memberships vs renewals vs trials. */
  newRevenue: number;
  renewalRevenue: number;
  trialRevenue: number;
  /** Revenue per plan name, sorted highest first. */
  byPlan: { name: string; revenue: number }[];
}

/** Payment-ledger sales in an IST date range (plus legacy memberships with no ledger lines). */
export async function fetchSales(from: string, to: string, memberMode?: MemberModeFilter): Promise<Sale[]> {
  const ids = await memberIdsForMode(memberMode);
  const start = `${from}T00:00:00+05:30`;
  const end = `${to}T23:59:59.999+05:30`;
  const pays = await readAllPages((a, b) => {
    let q = supabase
      .from("wellness_payments")
      .select("id, membership_id, member_id, amount, mode, reference, context, paid_at, note, wellness_plans(name, plan_type), wellness_memberships(wellness_plans(name, plan_type))")
      .gte("paid_at", start)
      .lte("paid_at", end)
      .order("id")
      .range(a, b);
    if (ids) q = q.in("member_id", ids);
    return q;
  });
  if (pays.error) throw pays.error;
  const legacyQ = await readAllPages((a, b) => {
    let q = supabase
      .from("wellness_memberships")
      .select("id, member_id, price_paid, payment_mode, renewed_from, created_at, wellness_plans(name, plan_type), wellness_payments(id)")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("id")
      .range(a, b);
    if (ids) q = q.in("member_id", ids);
    return q;
  });
  if (legacyQ.error) throw legacyQ.error;
  type P = { name: string; plan_type: string } | null;
  const payments: LedgerPayment[] = (pays.data as any[]).map((p) => {
    const plan: P = p.wellness_plans ?? p.wellness_memberships?.wellness_plans ?? null;
    return { ...p, amount: Number(p.amount), plan_name: plan?.name ?? null, plan_type: plan?.plan_type ?? null };
  });
  const legacy: LegacySale[] = (legacyQ.data as any[])
    .filter((m) => !(m.wellness_payments ?? []).length)
    .map((m) => ({ ...m, plan_name: m.wellness_plans?.name ?? null, plan_type: m.wellness_plans?.plan_type ?? null }));
  return buildSales(payments, legacy);
}

/** Memberships sold, revenue and servings used inside a date range. */
export function useSalesAnalytics(range: PeriodRange, memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["wellness-sales-analytics", range.from, range.to, memberMode ?? "all"],
    queryFn: async (): Promise<SalesSummary> => {
      const ids = await memberIdsForMode(memberMode);
      const servingsPage = (from: number, to: number) => {
        let q = supabase
          .from("wellness_attendance")
          .select("id, member_id, serving_deducted, visit_date")
          .gte("visit_date", range.from)
          .lte("visit_date", range.to)
          .order("id")
          .range(from, to);
        if (ids) q = q.in("member_id", ids);
        return q;
      };
      const [sales, servings] = await Promise.all([fetchSales(range.from, range.to, memberMode), readAllPages(servingsPage)]);
      if (servings.error) throw servings.error;
      const s = summarise(sales);
      const planMap = new Map<string, number>();
      for (const r of sales) planMap.set(r.planName, (planMap.get(r.planName) ?? 0) + r.amount);
      return {
        memberships: sales.length,
        revenue: s.revenue,
        servings: (servings.data ?? []).filter((r) => (r as { serving_deducted: boolean }).serving_deducted).length,
        newRevenue: s.newRevenue,
        renewalRevenue: s.renewalRevenue,
        trialRevenue: s.trialRevenue,
        byPlan: [...planMap.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
      };
    },
  });
}

/* --------------------------- Sales drill-down --------------------------- */

export interface SalesDrillDownRow {
  id: string;
  memberId: string;
  memberName: string;
  mobile: string;
  planName: string;
  planType: string | null;
  pricePaid: number;
  paymentMode: string;
  totalServings: number;
  isRenewal: boolean;
  createdAt: string;
  payments: { amount: number; mode: string; paidAt: string; note: string | null }[];
}

export interface SalesDrillDownResult {
  rows: SalesDrillDownRow[];
  totalRevenue: number;
  totalMemberships: number;
  totalServings: number;
  byCash: number;
  byUpi: number;
  byOnline: number;
  byCard: number;
}

/** Sales (payments collected) in an IST date range, with split-payment detail. */
export function useSalesDrillDown(from: string, to: string, memberMode?: MemberModeFilter, enabled = true) {
  return useQuery({
    queryKey: ["sales-drilldown", from, to, memberMode ?? "all"],
    enabled,
    queryFn: async (): Promise<SalesDrillDownResult> => {
      const sales = await fetchSales(from, to, memberMode);
      const memberIds = [...new Set(sales.map((s) => s.memberId))];
      const msIds = [...new Set(sales.map((s) => s.membershipId))];
      const [mem, ms] = await Promise.all([
        memberIds.length ? supabase.from("wellness_members").select("id, full_name, mobile_number").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
        msIds.length ? supabase.from("wellness_memberships").select("id, total_servings").in("id", msIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (mem.error) throw mem.error;
      if (ms.error) throw ms.error;
      const M = new Map((mem.data as any[]).map((m) => [m.id, m]));
      const S = new Map((ms.data as any[]).map((m) => [m.id, m.total_servings as number]));
      const sum = summarise(sales);
      const rows: SalesDrillDownRow[] = sales.map((s) => ({
        id: s.key,
        memberId: s.memberId,
        memberName: M.get(s.memberId)?.full_name ?? "Member",
        mobile: M.get(s.memberId)?.mobile_number ?? "",
        planName: s.planName,
        planType: s.planType,
        pricePaid: s.amount,
        paymentMode: s.mode,
        totalServings: S.get(s.membershipId) ?? 0,
        isRenewal: s.kind === "renewal",
        createdAt: s.paidAt,
        payments: s.lines.map((l) => ({ amount: l.amount, mode: l.mode, paidAt: l.paidAt, note: l.note })),
      }));
      return {
        rows,
        totalRevenue: sum.revenue,
        totalMemberships: rows.length,
        totalServings: rows.reduce((t, r) => t + r.totalServings, 0),
        byCash: sum.byMode.cash ?? 0,
        byUpi: sum.byMode.upi ?? 0,
        byOnline: sum.byMode.online ?? 0,
        byCard: sum.byMode.card ?? 0,
      };
    },
  });
}

/** Remaining servings of the active membership, keyed by member id. */
export function useMemberBalances(memberIds: string[]) {
  const key = [...memberIds].sort().join(",");
  return useQuery({
    queryKey: ["wellness-member-balances", key],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_memberships")
        .select("member_id, remaining_servings, status, end_date")
        .in("member_id", memberIds)
        .in("status", ["active", "expiring_soon"])
        .order("end_date", { ascending: false });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const r = row as { member_id: string; remaining_servings: number };
        map[r.member_id] = (map[r.member_id] ?? 0) + Number(r.remaining_servings ?? 0);
      }
      return map;
    },
  });
}

/* ------------------------------- Pink Card ------------------------------- */

/** One Pink Card serving is worth this much rupee discount at renewal. */
export const PINK_CARD_SERVING_VALUE = 250;

export interface PinkCardEntry {
  id: string;
  member_id: string;
  change: number;
  balance_after: number;
  reason: string;
  reference_id: string | null;
  referred_member_id: string | null;
  note: string | null;
  created_at: string;
  referred?: { id: string; full_name: string } | null;
}

export function usePinkCardLedger(memberId: string | undefined) {
  return useQuery({
    queryKey: ["pink-card-ledger", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pink_card_ledger")
        .select("*, referred:referred_member_id(id, full_name)")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PinkCardEntry[];
    },
  });
}

/** Pink Card balances keyed by member id, for list/search badges. */
export function usePinkCardBalances(memberIds: string[]) {
  const key = [...memberIds].sort().join(",");
  return useQuery({
    queryKey: ["pink-card-balances", key],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_members")
        .select("id, pink_card_balance")
        .in("id", memberIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { id: string; pink_card_balance: number | null }[]) {
        map[row.id] = row.pink_card_balance ?? 0;
      }
      return map;
    },
  });
}

/** Manual add/remove of Pink Card credit (admin & manager only). */
export function useAdjustPinkCard() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { memberId: string; change: number; note?: string | null }) => {
      const { error } = await supabase.rpc("adjust_pink_card", {
        p_member_id: args.memberId,
        p_change: args.change,
        p_note: args.note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      t.success("Pink Card updated");
    },
    onError: t.onError,
  });
}

/** Redeem Pink Card credit as a renewal discount. */
export function useRedeemPinkCard() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { memberId: string; credits: number; membershipId?: string | null; note?: string | null }) => {
      const { error } = await supabase.rpc("redeem_pink_card", {
        p_member_id: args.memberId,
        p_credits: args.credits,
        p_membership_id: args.membershipId ?? null,
        p_note: args.note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: t.onError,
  });
}

/** Redeem Pink Card credit as extra servings on the active membership. */
export function useRedeemPinkCardAsServings() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { memberId: string; credits: number; note?: string | null }) => {
      const { data, error } = await supabase.rpc("redeem_pink_card_as_servings" as never, {
        p_member_id: args.memberId,
        p_credits: args.credits,
        p_note: args.note ?? undefined,
      } as never);
      if (error) throw error;
      return data as unknown as { new_balance: number; new_servings: number };
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: t.onError,
  });
}

// ---------- Lead Management ----------

export interface WellnessLead {
  id: string;
  full_name: string;
  mobile_number: string;
  gender: string | null;
  date_of_birth: string | null;
  city: string | null;
  area: string | null;
  goal: string | null;
  height: string | null;
  joining_weight: string | null;
  health_issues: string | null;
  source: string;
  source_detail: string | null;
  tags: string[];
  status: "new" | "contacted" | "approved" | "rejected" | "converted";
  notes: string | null;
  assigned_to: string | null;
  converted_member_id: string | null;
  converted_trial_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeads(statusFilter?: string[]) {
  return useQuery({
    queryKey: ["wellness-leads", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("wellness_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter.length > 0) {
        q = q.in("status", statusFilter as ("new" | "contacted" | "approved" | "rejected" | "converted")[]);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as WellnessLead[];
    },
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      status,
      notes,
    }: {
      leadId: string;
      status: string;
      notes?: string;
    }) => {
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (notes !== undefined) update.notes = notes;
      const { error } = await supabase
        .from("wellness_leads")
        .update(update)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness-leads"] }),
  });
}

export function useApproveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, planId }: { leadId: string; planId?: string }) => {
      const { data, error } = await supabase.rpc("approve_lead", {
        p_lead_id: leadId,
        p_plan_id: planId,
      });
      if (error) throw error;
      return data as { status: string; member_id?: string; trial_id?: string; member_name?: string; message?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-leads"] });
      qc.invalidateQueries({ queryKey: ["active-trials"] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("wellness_leads")
        .delete()
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness-leads"] }),
  });
}

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from("wellness_leads")
        .delete()
        .in("id", leadIds);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness-leads"] }),
  });
}

// ---------- WLP Sessions ----------

export interface WlpSession {
  id: string;
  title: string;
  session_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface WlpCheckin {
  id: string;
  session_id: string;
  member_id: string;
  membership_id: string | null;
  serving_deducted: boolean;
  checkin_method: string;
  checked_in_at: string;
  wellness_members?: { full_name: string; mobile_number: string } | null;
}

export function useWlpSessions() {
  return useQuery({
    queryKey: ["wlp-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wlp_sessions")
        .select("*")
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data as unknown as WlpSession[];
    },
  });
}

export function useCreateWlpSession() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { title: string; sessionDate: string; notes?: string }) => {
      const { data, error } = await supabase.rpc("create_wlp_session", {
        p_title: args.title,
        p_session_date: args.sessionDate,
        p_notes: args.notes ?? undefined,
      });
      if (error) throw error;
      return data as unknown as WlpSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wlp-sessions"] });
      t.success("WLP session created");
    },
    onError: t.onError,
  });
}

export function useDeleteWlpSession() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("delete_wlp_session", { p_session_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wlp-sessions"] });
      t.success("Session deleted");
    },
    onError: t.onError,
  });
}

export function useWlpCheckins(sessionId: string | null) {
  return useQuery({
    queryKey: ["wlp-checkins", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wlp_checkins")
        .select("*, wellness_members(full_name, mobile_number)")
        .eq("session_id", sessionId!)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WlpCheckin[];
    },
  });
}

export function useWlpCheckinMember() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { sessionId: string; memberId: string }) => {
      const { data, error } = await supabase.rpc("wlp_checkin_member", {
        p_session_id: args.sessionId,
        p_member_id: args.memberId,
      });
      if (error) throw error;
      return data as unknown as { status: string; checkin_id?: string; remaining?: number | null; warning?: string | null; member_name?: string; message?: string };
    },
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ["wlp-checkins"] });
      qc.invalidateQueries({ queryKey: ["wlp-attendance"] });
    },
    onError: t.onError,
  });
}

export function useUndoWlpCheckin() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase.rpc("undo_wlp_checkin", { p_checkin_id: checkinId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wlp-checkins"] });
      qc.invalidateQueries({ queryKey: ["wlp-attendance"] });
      t.success("Check-in undone");
    },
    onError: t.onError,
  });
}

export interface WlpMonthlyCheckin {
  member_id: string;
  member_name: string;
  member_gender: string | null;
  wednesday_count: number;
}

export function useWlpMonthlyCheckins(month: string) {
  return useQuery({
    queryKey: ["wlp-monthly-checkins", month],
    queryFn: async () => {
      const monthStart = `${month}-01`;
      const nextMonth = new Date(monthStart + "T00:00:00");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = new Date(nextMonth.getTime() - 86400000)
        .toISOString()
        .slice(0, 10);

      const { data: sessions, error: sErr } = await supabase
        .from("wlp_sessions")
        .select("id, session_date")
        .gte("session_date", monthStart)
        .lte("session_date", monthEnd);
      if (sErr) throw sErr;

      const wedSessions = (sessions ?? []).filter((s) => {
        const d = new Date(s.session_date + "T12:00:00");
        return d.getDay() === 3;
      });
      if (!wedSessions.length) return [] as WlpMonthlyCheckin[];

      const sessionIds = wedSessions.map((s) => s.id);
      const { data: checkins, error: cErr } = await supabase
        .from("wlp_checkins")
        .select("member_id, session_id, wellness_members(full_name, gender)")
        .in("session_id", sessionIds);
      if (cErr) throw cErr;

      const map = new Map<string, { name: string; gender: string | null; dates: Set<string> }>();
      for (const c of checkins ?? []) {
        const sess = wedSessions.find((s) => s.id === c.session_id);
        if (!sess) continue;
        let entry = map.get(c.member_id);
        if (!entry) {
          const mem = c.wellness_members as unknown as { full_name: string; gender: string | null } | null;
          entry = { name: mem?.full_name ?? "Member", gender: mem?.gender ?? null, dates: new Set() };
          map.set(c.member_id, entry);
        }
        entry.dates.add(sess.session_date);
      }

      return Array.from(map.entries()).map(([id, e]) => ({
        member_id: id,
        member_name: e.name,
        member_gender: e.gender,
        wednesday_count: e.dates.size,
      }));
    },
  });
}

// ---------- MIW Challenges ----------

export interface MiwChallenge {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  fee: number;
  status: string;
  created_at: string;
}

export function useMiwChallenges() {
  return useQuery({
    queryKey: ["miw-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("miw_challenges")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as MiwChallenge[];
    },
  });
}

export function useCreateMiwChallenge() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { name: string; startDate: string; endDate: string; fee: number }) => {
      const { data, error } = await supabase
        .from("miw_challenges")
        .insert({ name: args.name, start_date: args.startDate, end_date: args.endDate, fee: args.fee })
        .select()
        .single();
      if (error) throw error;
      return data as MiwChallenge;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["miw-challenges"] });
      t.success("Challenge created");
    },
    onError: t.onError,
  });
}

export function useUpdateMiwChallenge() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { id: string; name?: string; startDate?: string; endDate?: string; fee?: number; status?: string }) => {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.startDate !== undefined) updates.start_date = args.startDate;
      if (args.endDate !== undefined) updates.end_date = args.endDate;
      if (args.fee !== undefined) updates.fee = args.fee;
      if (args.status !== undefined) updates.status = args.status;
      const { error } = await supabase.from("miw_challenges").update(updates).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["miw-challenges"] });
      t.success("Challenge updated");
    },
    onError: t.onError,
  });
}

export function useMiwRegisterMember() {
  const qc = useQueryClient();
  const t = useToastedMutation();
  return useMutation({
    mutationFn: async (args: { challengeId: string; memberId: string; payments: { amount: number; mode: string; reference?: string }[] }) => {
      const { data, error } = await supabase.rpc("miw_register_member", {
        p_challenge_id: args.challengeId,
        p_member_id: args.memberId,
        p_payments: JSON.stringify(args.payments),
      } as never);
      if (error) throw error;
      return data as { status: string; participant_id?: string; amount_paid?: number; member_name?: string; message?: string };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["miw-"] });
      qc.invalidateQueries({ queryKey: ["wellness-members"] });
      if (result.status === "already_registered") {
        t.error(result.message ?? "Already registered");
      } else {
        t.success(`${result.member_name ?? "Member"} registered — ₹${result.amount_paid ?? 0} paid`);
      }
    },
    onError: t.onError,
  });
}

export interface MiwReportParticipant {
  participant_id: string;
  member_id: string;
  member_name: string;
  mobile: string;
  gender: string | null;
  source: string;
  joined_at: string;
  start_weight: number | null;
  latest_weight: number | null;
  visits: number;
}

export interface MiwReportData {
  challenge: MiwChallenge;
  total_paid: number;
  participant_count: number;
  participants: MiwReportParticipant[];
}

export function useMiwReport(challengeId: string | null) {
  return useQuery({
    queryKey: ["miw-report", challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("miw_report", { p_challenge_id: challengeId! } as never);
      if (error) throw error;
      return data as unknown as MiwReportData;
    },
  });
}

// ---------- Attendance Register ----------

export type AttendanceMark = "visit" | "serving";

export interface AttendanceRow {
  memberId: string;
  name: string;
  mobile: string;
  memberMode: string;
  status: string;
  planName: string | null;
  remainingServings: number | null;
  dayMap: Record<string, AttendanceMark | null>;
  presentDays: number;
  visitDays: number;
  servingDays: number;
  wlpByDate: Record<string, boolean>;
  wlpDays: number;
  absentDays: number;
  percentage: number;
  initialWeight: number | null;
  goal: string | null;
  weightByDate: Record<string, number>;
  latestWeight: number | null;
  latestWeightDate: string | null;
  totalChange: number | null;
}

export interface AttendanceRegisterResult {
  rows: AttendanceRow[];
  dates: string[];
  countedDates: string[];
  today: string;
  totalMembers: number;
  todayPresent: number;
  todayServed: number;
  todayWlp: number;
  todayAbsent: number;
  avgAttendance: number;
  bestAttendee: { name: string; percentage: number } | null;
}

function isoDateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const d = new Date(Date.UTC(fy, fm - 1, fd));
  const end = Date.UTC(ty, tm - 1, td);
  while (d.getTime() <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function useAttendanceRegister(from: string, to: string, memberMode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["attendance-register", from, to, memberMode],
    enabled: !!from && !!to && from <= to,
    queryFn: async (): Promise<AttendanceRegisterResult> => {
      let mq = supabase
        .from("wellness_members")
        .select("id, full_name, mobile_number, member_mode, status, initial_weight, goal")
        .in("status", ["active_member", "renewal_due", "trial", "expired"]);
      if (memberMode && memberMode !== "all") mq = mq.eq("member_mode", memberMode);
      const { data: members, error: mErr } = await mq.limit(5000);
      if (mErr) throw mErr;
      const ids = (members ?? []).map((m) => m.id);

      const mship: Record<string, { planName: string | null; remaining: number | null }> = {};
      if (ids.length) {
        const { data: ms } = await supabase
          .from("wellness_memberships")
          .select("member_id, status, remaining_servings, wellness_plans(name)")
          .in("member_id", ids)
          .in("status", ["active", "expiring_soon", "queued"]);
        const rank: Record<string, number> = { active: 0, expiring_soon: 1, queued: 2 };
        const sorted = [...(ms ?? [])].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
        for (const m of sorted) {
          if (!mship[m.member_id]) {
            mship[m.member_id] = {
              planName: (m.wellness_plans as { name?: string } | null)?.name ?? null,
              remaining: m.remaining_servings,
            };
          }
        }
      }

      const attMap: Record<string, Map<string, AttendanceMark>> = {};
      const pageSize = 1000;
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from("wellness_attendance")
          .select("member_id, visit_date, checkin_method")
          .gte("visit_date", from)
          .lte("visit_date", to)
          .order("visit_date")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        for (const a of data ?? []) {
          (attMap[a.member_id] ??= new Map()).set(
            a.visit_date,
            (a.checkin_method as string) === "serving_issue" ? "serving" : "visit",
          );
        }
        if (!data || data.length < pageSize) break;
      }

      // WLP evening session check-ins (separate from club attendance).
      const wlpMap: Record<string, Set<string>> = {};
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from("wlp_checkins")
          .select("member_id, wlp_sessions!inner(session_date)")
          .gte("wlp_sessions.session_date", from)
          .lte("wlp_sessions.session_date", to)
          .order("id")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        for (const w of (data ?? []) as unknown as { member_id: string; wlp_sessions: { session_date: string } | null }[]) {
          const d = w.wlp_sessions?.session_date;
          if (d) (wlpMap[w.member_id] ??= new Set()).add(d);
        }
        if (!data || data.length < pageSize) break;
      }

      // Weight readings up to `to`, ordered so later readings overwrite earlier ones.
      const wByDate: Record<string, Record<string, number>> = {};
      const wLatest: Record<string, { w: number; d: string }> = {};
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from("weight_tracking")
          .select("member_id, recorded_date, weight, created_at")
          .lte("recorded_date", to)
          .order("recorded_date")
          .order("created_at")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        for (const w of data ?? []) {
          const val = Number(w.weight);
          if (w.recorded_date >= from) (wByDate[w.member_id] ??= {})[w.recorded_date] = val;
          wLatest[w.member_id] = { w: val, d: w.recorded_date };
        }
        if (!data || data.length < pageSize) break;
      }

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const dates = isoDateRange(from, to);
      const countedDates = dates.filter((d) => d <= today);
      let todayPresent = 0;
      let todayServed = 0;
      let todayWlp = 0;

      const rows: AttendanceRow[] = (members ?? []).map((m) => {
        const init = m.initial_weight != null ? Number(m.initial_weight) : null;
        const latest = wLatest[m.id] ?? null;
        const visited = attMap[m.id] ?? new Map<string, AttendanceMark>();
        const dayMap: Record<string, AttendanceMark | null> = {};
        for (const d of dates) dayMap[d] = visited.get(d) ?? null;
        const wlpSet = wlpMap[m.id] ?? new Set<string>();
        const wlpByDate: Record<string, boolean> = {};
        for (const d of dates) if (wlpSet.has(d)) wlpByDate[d] = true;
        const counted = countedDates.filter((d) => visited.has(d) || wlpSet.has(d));
        const presentDays = counted.length;
        const servingDays = counted.filter((d) => visited.get(d) === "serving").length;
        const wlpDays = countedDates.filter((d) => wlpSet.has(d)).length;
        const wlpOnly = counted.filter((d) => !visited.has(d)).length;
        if (wlpSet.has(today)) todayWlp++;
        const absentDays = countedDates.length - presentDays;
        if (visited.get(today) === "visit") todayPresent++;
        else if (visited.get(today) === "serving") todayServed++;
        return {
          memberId: m.id,
          name: m.full_name,
          mobile: m.mobile_number ?? "",
          memberMode: m.member_mode,
          status: m.status,
          planName: mship[m.id]?.planName ?? null,
          remainingServings: mship[m.id]?.remaining ?? null,
          dayMap,
          presentDays,
          visitDays: presentDays - servingDays - wlpOnly,
          servingDays,
          wlpByDate,
          wlpDays,
          absentDays,
          percentage: countedDates.length ? Math.round((presentDays / countedDates.length) * 100) : 0,
          initialWeight: init,
          goal: (m.goal as string | null) ?? null,
          weightByDate: wByDate[m.id] ?? {},
          latestWeight: latest?.w ?? null,
          latestWeightDate: latest?.d ?? null,
          totalChange: init != null && latest ? Math.round((latest.w - init) * 10) / 10 : null,
        };
      });
      rows.sort((a, b) => a.name.localeCompare(b.name));
      const totalMembers = rows.length;
      const avgAttendance = totalMembers ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / totalMembers) : 0;
      const best = rows.length ? rows.reduce((a, b) => (b.percentage > a.percentage ? b : a)) : null;
      return {
        rows, dates, countedDates, today, totalMembers, todayPresent, todayServed, todayWlp,
        todayAbsent: Math.max(0, totalMembers - rows.filter((r) => r.dayMap[today] || r.wlpByDate[today]).length), avgAttendance,
        bestAttendee: best && best.presentDays > 0 ? { name: best.name, percentage: best.percentage } : null,
      };
    },
  });
}

// ---------- Servings issued (packed) ----------

export interface ServingIssuedRow {
  id: string;
  memberId: string;
  memberName: string;
  mobile: string;
  planName: string;
  quantity: number;
  reason: string | null;
  issuedAt: string;
  markedDates: string[];
}

export interface ServingIssuedResult {
  rows: ServingIssuedRow[];
  totalServings: number;
  totalMembers: number;
}

async function fetchServingsIssued(from: string, to: string, mode?: MemberModeFilter): Promise<ServingIssuedResult> {
  const ids = await memberIdsForMode(mode);
  let q = supabase
    .from("serving_transactions")
    .select("id, member_id, membership_id, change, note, created_at, wellness_members(full_name, mobile_number), wellness_memberships(wellness_plans(name))")
    .eq("txn_type", "pack_and_issue" as never)
    .gte("created_at", `${from}T00:00:00+05:30`)
    .lte("created_at", `${to}T23:59:59.999+05:30`)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (ids) q = q.in("member_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q;
  if (error) throw error;
  type Txn = {
    id: string; member_id: string; membership_id: string; change: number; note: string | null; created_at: string;
    wellness_members: { full_name?: string; mobile_number?: string } | null;
    wellness_memberships: { wellness_plans?: { name?: string } | null } | null;
  };
  const txns = (data ?? []) as unknown as Txn[];

  // Packed dates are stored as attendance rows; match them by who issued them, when.
  const byMember: Record<string, { date: string; created: string }[]> = {};
  const memberIds = [...new Set(txns.map((t) => t.member_id))];
  if (memberIds.length) {
    const { data: att } = await supabase
      .from("wellness_attendance")
      .select("member_id, visit_date, created_at")
      .eq("checkin_method", "serving_issue" as never)
      .in("member_id", memberIds)
      .gte("created_at", `${from}T00:00:00+05:30`)
      .lte("created_at", `${to}T23:59:59.999+05:30`)
      .order("visit_date");
    for (const a of att ?? []) (byMember[a.member_id] ??= []).push({ date: a.visit_date, created: a.created_at });
  }

  const rows: ServingIssuedRow[] = txns.map((t) => {
    const ts = new Date(t.created_at).getTime();
    const marked = (byMember[t.member_id] ?? [])
      .filter((a) => Math.abs(new Date(a.created).getTime() - ts) < 5000)
      .map((a) => a.date);
    return {
      id: t.id,
      memberId: t.member_id,
      memberName: t.wellness_members?.full_name ?? "Member",
      mobile: t.wellness_members?.mobile_number ?? "",
      planName: t.wellness_memberships?.wellness_plans?.name ?? "Plan",
      quantity: Math.abs(t.change),
      reason: t.note,
      issuedAt: t.created_at,
      markedDates: marked,
    };
  });
  return {
    rows,
    totalServings: rows.reduce((s, r) => s + r.quantity, 0),
    totalMembers: new Set(rows.map((r) => r.memberId)).size,
  };
}

export function useTodayServingsIssued(mode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["serving-issued-today", mode ?? "all"],
    queryFn: () => {
      const today = istDateStr(new Date());
      return fetchServingsIssued(today, today, mode);
    },
    refetchInterval: 30_000,
  });
}

export function useServingsIssuedReport(from: string, to: string, mode?: MemberModeFilter) {
  return useQuery({
    queryKey: ["serving-report", from, to, mode ?? "all"],
    enabled: !!from && !!to && from <= to,
    queryFn: () => fetchServingsIssued(from, to, mode),
  });
}

/** Dates (within the list) where the member already has attendance. */
export function useMemberAttendanceOnDates(memberId: string | undefined, dates: string[]) {
  return useQuery({
    queryKey: ["member-attendance-dates", memberId, dates.join(",")],
    enabled: !!memberId && dates.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("visit_date")
        .eq("member_id", memberId!)
        .in("visit_date", dates);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.visit_date as string));
    },
  });
}
