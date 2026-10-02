import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeAlert =
  | {
      kind: "checkin";
      id: string; // request id
      memberId: string;
      name: string;
      mobile: string;
      requestedWeight: number | null;
      lastWeight: number | null;
      remaining: number | null;
      at: number;
    }
  | {
      kind: "milestone";
      id: string; // member_achievement id
      memberId: string;
      name: string;
      milestone: string;
      icon: string | null;
      at: number;
    };

export function playAlertSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // audio unavailable or blocked — the pop-up still shows
  }
}

async function buildCheckin(req: { id: string; member_id: string; requested_weight: number | null }) {
  const [m, ms, w] = await Promise.all([
    supabase.from("wellness_members").select("full_name, mobile_number, current_weight").eq("id", req.member_id).maybeSingle(),
    supabase
      .from("wellness_memberships")
      .select("remaining_servings")
      .eq("member_id", req.member_id)
      .in("status", ["active", "expiring_soon"])
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_tracking")
      .select("weight")
      .eq("member_id", req.member_id)
      .order("recorded_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    kind: "checkin" as const,
    id: req.id,
    memberId: req.member_id,
    name: m.data?.full_name ?? "Member",
    mobile: m.data?.mobile_number ?? "",
    requestedWeight: req.requested_weight,
    lastWeight: w.data?.weight ?? m.data?.current_weight ?? null,
    remaining: ms.data?.remaining_servings ?? null,
    at: Date.now(),
  };
}

export function useRealtimeAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const seen = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => {
    setAlerts((a) => a.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((alert: RealtimeAlert) => {
    setAlerts((a) => (a.some((x) => x.id === alert.id) ? a : [alert, ...a]));
    playAlertSound();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("staff-realtime-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wellness_checkin_requests" }, async (payload) => {
        const row = payload.new as { id: string; member_id: string; status: string; requested_weight: number | null };
        if (row.status !== "pending" || seen.current.has(row.id)) return;
        seen.current.add(row.id);
        push(await buildCheckin(row));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wellness_checkin_requests" }, (payload) => {
        const row = payload.new as { id: string; status: string };
        if (row.status !== "pending") {
          // Handled here or on another device — close it after a short beat so local "Approved" feedback shows.
          setTimeout(() => dismiss(row.id), 1500);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "member_achievements" }, async (payload) => {
        const row = payload.new as { id: string; member_id: string; achievement_id: string };
        if (seen.current.has(row.id)) return;
        seen.current.add(row.id);
        const [m, a] = await Promise.all([
          supabase.from("wellness_members").select("full_name").eq("id", row.member_id).maybeSingle(),
          supabase.from("achievement_definitions").select("name, icon").eq("id", row.achievement_id).maybeSingle(),
        ]);
        push({
          kind: "milestone",
          id: row.id,
          memberId: row.member_id,
          name: m.data?.full_name ?? "Member",
          milestone: a.data?.name ?? "a milestone",
          icon: a.data?.icon ?? null,
          at: Date.now(),
        });
        setTimeout(() => dismiss(row.id), 15000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, push, dismiss]);

  return { alerts, dismiss };
}
