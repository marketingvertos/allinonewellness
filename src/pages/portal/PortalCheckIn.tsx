import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelfCheckIn, useCheckInWithWeight, useMyCheckInRequest } from "@/hooks/useWellness";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrScannerSheet } from "@/components/wellness/QrScannerSheet";
import { CheckCircle2, Camera, Clock, Loader2, QrCode, XCircle } from "lucide-react";

type Result = {
  status: string;
  message?: string;
  remaining?: number;
  mode?: string;
  request_id?: string;
};

export default function PortalCheckIn() {
  const [params] = useSearchParams();
  const linkCode = params.get("c");
  const selfCheckIn = useSelfCheckIn();
  const { user } = useAuth();
  const { data: identity } = useMemberIdentity();
  const logWeight = useCheckInWithWeight();
  const [weight, setWeight] = useState("");
  const [weightSaved, setWeightSaved] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const { data: request } = useMyCheckInRequest(requestId);

  const runCheckIn = useCallback(
    async (code: string) => {
      setRunning(true);
      setError(null);
      setResult(null);
      setRequestId(null);
      try {
        const r = (await selfCheckIn.mutateAsync(code)) as Result;
        setResult(r);
        if (r.status === "pending" && r.request_id) setRequestId(r.request_id);
      } catch {
        setError("We could not send your check-in request. Please ask the front desk.");
      } finally {
        setRunning(false);
      }
    },
    [selfCheckIn],
  );

  useEffect(() => {
    if (!linkCode || attempted.current) return;
    attempted.current = true;
    void runCheckIn(linkCode);
  }, [linkCode, runCheckIn]);

  const status = request?.status ?? result?.status;
  const waiting = status === "pending";
  const duplicate = result?.status === "duplicate";
  const approved = status === "approved" || duplicate;
  const rejected = status === "rejected" || status === "expired";
  const failed = !waiting && !approved && !rejected && !!result && result.status !== "ok";
  const idle = !running && !result && !error;

  if (idle) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Check in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <QrCode className="h-10 w-10 text-primary" />
            <p>
              Tap below to open your camera and scan the QR poster at the centre. Your request is sent to the
              front desk — one serving is deducted only after they approve it.
            </p>
            <Button className="w-full" size="lg" onClick={() => setScanning(true)}>
              <Camera className="mr-2 h-5 w-5" /> Scan QR to check in
            </Button>
          </CardContent>
        </Card>
        <QrScannerSheet open={scanning} onOpenChange={setScanning} onResult={runCheckIn} />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          {running && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
          {running && <p className="text-muted-foreground">Sending your check-in request…</p>}

          {!running && (
            <>
              {waiting ? (
                <Clock className="mx-auto h-12 w-12 animate-pulse text-primary" />
              ) : approved ? (
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              ) : (
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
              )}

              <h2 className="text-xl font-semibold">
                {waiting
                  ? "Waiting for approval"
                  : duplicate
                    ? "Already checked in today"
                    : approved
                      ? "Checked in"
                      : rejected
                        ? "Check-in not approved"
                        : "Check-in not recorded"}
              </h2>

              <p className="text-muted-foreground">
                {error ??
                  (waiting
                    ? "Your request has been sent to the front desk. This screen updates automatically once it is approved."
                    : duplicate
                      ? "Your visit for today is already recorded — no extra serving has been deducted."
                      : approved
                        ? "Your visit is recorded and one serving has been deducted."
                        : rejected
                          ? request?.reject_reason ||
                            (status === "expired"
                              ? "This request expired. Please scan again."
                              : "The front desk did not approve this check-in.")
                          : result?.message ?? "Please review your plan at the front desk.")}
              </p>


              {approved && identity?.memberId && !weightSaved && (
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
                        setWeightError(null);
                        try {
                          await logWeight.mutateAsync({
                            memberId: identity.memberId!,
                            skipCheckIn: true,
                            weight: Number(weight),
                            recordedBy: user?.id ?? null,
                          });
                          setWeightSaved(true);
                        } catch {
                          setWeightError("Your visit is recorded, but we could not save the weight. Tell the front desk.");
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                  {weightError ? (
                    <p className="text-xs text-destructive">{weightError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Optional — helps your coach track progress.</p>
                  )}
                </div>
              )}
              {weightSaved && <p className="text-sm text-primary">Weight recorded. Great work!</p>}

              <div className="flex flex-wrap justify-center gap-2">
                {(rejected || failed || error) && (
                  <Button onClick={() => setScanning(true)}>
                    <Camera className="mr-2 h-4 w-4" /> Scan again
                  </Button>
                )}
                <Button variant="outline" onClick={() => window.location.assign("/portal")}>
                  Back to my plan
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <QrScannerSheet open={scanning} onOpenChange={setScanning} onResult={runCheckIn} />
    </>
  );
}
