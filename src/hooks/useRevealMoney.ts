import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AUTO_HIDE_MS = 60_000;

/** Whether the signed-in user is an admin (only admins may reveal revenue). */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}

/** In-memory reveal state: hidden by default, auto-hides after 60s idle and on unmount. */
export function useRevealMoney() {
  const { data: isAdmin = false } = useIsAdmin();
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number>();

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRevealed(false), AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!revealed) return;
    arm();
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      window.clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [revealed, arm]);

  return {
    canReveal: isAdmin,
    revealed: isAdmin && revealed,
    toggle: () => setRevealed((r) => !r),
  };
}

export const MASKED_AMOUNT = "₹ • • • • •";
