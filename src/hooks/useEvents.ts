import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { currentMonthIst } from "@/lib/formatters";

export type EventType = "family_day" | "lifestyle_day" | "miw_challenge";

export interface WellnessEvent {
  id: string;
  event_type: string;
  title: string;
  event_date: string;
  end_date: string | null;
  month: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  member_id: string;
  start_weight: number | null;
  end_weight: number | null;
  status: string;
  wellness_members?: { full_name: string; mobile_number: string } | null;
}

export interface MonthlyReward {
  id: string;
  member_id: string;
  month: string;
  reward_type: string;
  details: Record<string, unknown>;
  is_delivered: boolean;
  wellness_members?: { full_name: string; mobile_number: string; gender: string | null } | null;
}

export interface WlpAttendanceRow {
  id: string;
  member_id: string;
  session_date: string;
  month: string;
}

function useToasted() {
  const { toast } = useToast();
  return {
    success: (title: string) => toast({ title }),
    onError: (e: unknown) =>
      toast({
        title: "Something went wrong",
        description: (e as Error).message,
        variant: "destructive",
      }),
  };
}

export { currentMonthIst };

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function recentMonths(count = 6) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/* ------------------------------- Events ------------------------------- */

export function useWellnessEvents(month: string, eventType?: EventType) {
  return useQuery({
    queryKey: ["wellness-events", month, eventType ?? "all"],
    queryFn: async () => {
      let q = supabase.from("wellness_events").select("*").eq("month", month);
      if (eventType) q = q.eq("event_type", eventType);
      const { data, error } = await q.order("event_date");
      if (error) throw error;
      return data as unknown as WellnessEvent[];
    },
  });
}

export function useUpcomingEvent(eventType: EventType) {
  return useQuery({
    queryKey: ["wellness-event-upcoming", eventType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_events")
        .select("*")
        .eq("event_type", eventType)
        .eq("month", currentMonthIst())
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WellnessEvent) ?? null;
    },
  });
}

export function useSaveEvent() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (event: {
      id?: string;
      event_type: string;
      title: string;
      event_date: string;
      end_date?: string | null;
      month: string;
      description?: string | null;
    }) => {
      const { error } = await supabase.from("wellness_events").upsert(event as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-events"] });
      qc.invalidateQueries({ queryKey: ["wellness-event-upcoming"] });
      t.success("Event saved");
    },
    onError: t.onError,
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wellness_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-events"] });
      qc.invalidateQueries({ queryKey: ["wellness-event-upcoming"] });
      t.success("Event removed");
    },
    onError: t.onError,
  });
}

/* ---------------------------- Participants ---------------------------- */

export function useEventParticipants(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_event_participants")
        .select("*, wellness_members(full_name, mobile_number)")
        .eq("event_id", eventId!)
        .order("created_at");
      if (error) throw error;
      return data as unknown as EventParticipant[];
    },
    enabled: !!eventId,
  });
}

export function useSaveParticipant() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (row: {
      id?: string;
      event_id: string;
      member_id: string;
      start_weight?: number | null;
      end_weight?: number | null;
    }) => {
      const { error } = await supabase
        .from("wellness_event_participants")
        .upsert(row as never, { onConflict: "event_id,member_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-participants"] });
      t.success("Participant saved");
    },
    onError: t.onError,
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wellness_event_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-participants"] });
      t.success("Participant removed");
    },
    onError: t.onError,
  });
}

/* ------------------------------- WLP days ------------------------------ */

export function useWlpAttendance(month: string) {
  return useQuery({
    queryKey: ["wlp-attendance", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_wlp_attendance")
        .select("*")
        .eq("month", month);
      if (error) throw error;
      return data as unknown as WlpAttendanceRow[];
    },
  });
}

export function useToggleWlpAttendance() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (args: {
      memberId: string;
      sessionDate: string;
      existingId?: string | null;
    }) => {
      if (args.existingId) {
        const { error } = await supabase
          .from("wellness_wlp_attendance")
          .delete()
          .eq("id", args.existingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("wellness_wlp_attendance").insert({
        member_id: args.memberId,
        session_date: args.sessionDate,
        month: args.sessionDate.slice(0, 7),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wlp-attendance"] });
    },
    onError: t.onError,
  });
}

/* ------------------------------- Rewards ------------------------------- */

export function useMonthlyRewards(month: string) {
  return useQuery({
    queryKey: ["monthly-rewards", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_monthly_rewards")
        .select("*, wellness_members(full_name, mobile_number, gender)")
        .eq("month", month);
      if (error) throw error;
      return data as unknown as MonthlyReward[];
    },
  });
}

export function useCalcMonthlyRewards() {
  const qc = useQueryClient();
  const t = useToasted();
  return useMutation({
    mutationFn: async (month: string) => {
      const { error } = await supabase.rpc("calc_monthly_rewards", { p_month: month } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-rewards"] });
      t.success("Rewards recalculated");
    },
    onError: t.onError,
  });
}

/** How many days a member attended in the given month (IST month key). */
export function useMyMonthlyAttendance(memberId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["my-monthly-attendance", memberId, month],
    queryFn: async () => {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("wellness_attendance")
        .select("visit_date")
        .eq("member_id", memberId!)
        .gte("visit_date", start)
        .lte("visit_date", end);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.visit_date as string)).size;
    },
    enabled: !!memberId,
  });
}
