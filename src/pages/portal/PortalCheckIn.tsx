import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelfCheckIn, useCheckInWithWeight } from "@/hooks/useWellness";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, QrCode, XCircle } from "lucide-react";

type Result = { status: string; message?: string; remaining?: number; mode?: string };

export default function PortalCheckIn() {
  const [params] = useSearchParams();
  const code = params.get("c");
  const selfCheckIn = useSelfCheckIn();
  const { user } = useAuth();
  const { data: identity } = useMemberIdentity();
  const logWeight = useCheckInWithWeight();
  const [weight, setWeight] = useState("");
  const [weightSaved, setWeightSaved] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!code || attempted.current) return;
    attempted.current = true;
    selfCheckIn
      .mutateAsync(code)
      .then((r) => setResult(r))
      .catch(() => setError("We could not record your check-in. Please ask the front desk."));
  }, [code, selfCheckIn]);

  if (!code) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <QrCode className="h-10 w-10 text-primary" />
          <p>
            Open your phone camera and scan the QR poster at the centre. It will bring you back here and record
            today&apos;s visit automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ok = result?.status === "ok";
  const pending = !result && !error;

  return (
    <Card>
      <CardContent className="space-y-4 py-10 text-center">
        {pending && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
        {pending && <p className="text-muted-foreground">Recording your check-in…</p>}

        {!pending && (
          <>
            {ok ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
            )}
            <h2 className="text-xl font-semibold">{ok ? "Checked in" : "Check-in not recorded"}</h2>
            <p className="text-muted-foreground">
              {error ??
                (ok
                  ? result?.mode === "trial"
                    ? "Trial visit recorded. Enjoy your session!"
                    : `One serving used. ${result?.remaining} servings left.`
                  : result?.message ?? "Please review your plan at the front desk.")}
            </p>
            {ok && identity?.memberId && !weightSaved && (
              <div className="mx-auto max-w-xs space-y-2 rounded-lg border p-4 text-left">
                <Label htmlFor="portal-weight">Today&apos;s weight (kg)</Label>
                <div className="flex gap-2">
                  <Input
                    id="portal-weight"
                    inputMode="decimal"
                    placeholder="e.g. 75.6"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  <Button
                    disabled={!weight || logWeight.isPending}
                    onClick={async () => {
                      await logWeight.mutateAsync({
                        memberId: identity.memberId!,
                        skipCheckIn: true,
                        weight: Number(weight),
                        recordedBy: user?.id ?? null,
                      });
                      setWeightSaved(true);
                    }}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Optional — helps your coach track progress.</p>
              </div>
            )}
            {weightSaved && <p className="text-sm text-primary">Weight recorded. Great work!</p>}

            <Button variant="outline" onClick={() => window.location.assign("/portal")}>
              Back to my plan
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
