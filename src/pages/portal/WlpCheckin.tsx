import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, Moon, XCircle } from "lucide-react";

type Result = {
  status: string;
  checkin_id?: string;
  remaining?: number | null;
  warning?: string | null;
  member_name?: string;
  message?: string;
};

export default function WlpCheckin() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkIn = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("wlp_self_checkin", {
        p_session_id: sessionId!,
      });
      if (error) throw error;
      return data as unknown as Result;
    },
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => setError(e.message),
  });

  const idle = !checkIn.isPending && !result && !error;
  const ok = result?.status === "ok";
  const duplicate = result?.status === "duplicate";
  const overdraft = result?.warning === "overdraft";
  const noMembership = result?.warning === "no_membership";

  if (idle) {
    return (
      <Card>
        <CardHeader className="text-center">
          <Moon className="mx-auto h-10 w-10 text-primary" />
          <CardTitle className="text-lg">WLP Session Check-in</CardTitle>
          <CardDescription>Tap below to mark your attendance for this evening's WLP session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg" onClick={() => checkIn.mutate()}>
            Check in now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-10 text-center">
        {checkIn.isPending && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
        {checkIn.isPending && <p className="text-muted-foreground">Checking you in…</p>}

        {!checkIn.isPending && (
          <>
            {ok ? (
              overdraft ? (
                <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
              ) : (
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              )
            ) : duplicate ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
            )}

            <h2 className="text-xl font-semibold">
              {ok
                ? "Checked in!"
                : duplicate
                  ? "Already checked in"
                  : error
                    ? "Check-in failed"
                    : result?.message ?? "Something went wrong"}
            </h2>

            <p className="text-muted-foreground">
              {ok && overdraft
                ? "Your attendance is recorded, but your serving balance is now negative. Please speak with staff about renewal."
                : ok && noMembership
                  ? "Your attendance is recorded. No serving was deducted because you don't have an active membership."
                  : ok && result?.remaining != null
                    ? `One serving deducted. ${result.remaining} serving${result.remaining === 1 ? "" : "s"} remaining.`
                    : duplicate
                      ? result?.message ?? "You've already checked in to this session."
                      : error ?? (result?.message || "Please ask the front desk for help.")}
            </p>

            <Button variant="outline" onClick={() => window.location.assign("/portal")}>
              Back to my plan
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
