import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelfCheckIn, useMyCheckInRequest } from "@/hooks/useWellness";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [weight, setWeight] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const { data: request } = useMyCheckInRequest(requestId);

  const runCheckIn = useCallback(
    async (scannedCode: string, enteredWeight: number | null) => {
      setRunning(true);
      setError(null);
      setResult(null);
      setRequestId(null);
      try {
        const r = (await selfCheckIn.mutateAsync({ code: scannedCode, weight: enteredWeight })) as Result;
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
    setCode(linkCode);
  }, [linkCode]);

  const status = request?.status ?? result?.status;
  const waiting = status === "pending";
  const duplicate = result?.status === "duplicate";
  const approved = status === "approved" || duplicate;
  const rejected = status === "rejected" || status === "expired";
  const failed = !waiting && !approved && !rejected && !!result && result.status !== "ok";
  const idle = !running && !result && !error;

  const resetFlow = () => {
    setCode(null);
    setResult(null);
    setRequestId(null);
    setError(null);
    setWeight("");
  };

  if (idle) {
    const weightNum = weight ? Number(weight) : null;
    const weightInvalid = weightNum != null && (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 400);

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{code ? "Request attendance" : "Check in"}</CardTitle>
            <CardDescription>
              {code
                ? "Enter today's weight, then send your attendance request to the front desk."
                : "Scan the QR poster at the centre to start."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {code ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="request-weight">Today&apos;s weight (kg)</Label>
                  <Input
                    id="request-weight"
                    inputMode="decimal"
                    placeholder="e.g. 75.6"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  {weightInvalid ? (
                    <p className="text-xs text-destructive">Enter a weight between 1 and 400 kg.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Optional — the team verifies it before approving your attendance.
                    </p>
                  )}
                </div>
                <p>
                  Your request goes to the front desk. Attendance is punched and one serving is deducted
                  only after they approve it.
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={weightInvalid}
                  onClick={() => void runCheckIn(code, weightInvalid ? null : weightNum)}
                >
                  Request attendance
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setScanning(true)}>
                  <Camera className="mr-2 h-4 w-4" /> Scan a different code
                </Button>
              </>
            ) : (
              <>
                <QrCode className="h-10 w-10 text-primary" />
                <p>
                  Tap below to open your camera and scan the QR poster at the centre. You can add today&apos;s
                  weight before sending the request.
                </p>
                <Button className="w-full" size="lg" onClick={() => setScanning(true)}>
                  <Camera className="mr-2 h-5 w-5" /> Scan QR to check in
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <QrScannerSheet open={scanning} onOpenChange={setScanning} onResult={(c) => setCode(c)} />
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
                        ? "Your visit is recorded, your weight is saved and one serving has been deducted."
                        : rejected
                          ? request?.reject_reason ||
                            (status === "expired"
                              ? "This request expired. Please scan again."
                              : "The front desk did not approve this check-in.")
                          : result?.message ?? "Please review your plan at the front desk.")}
              </p>

              {waiting && request?.requested_weight != null && (
                <p className="text-sm text-muted-foreground">
                  Weight submitted: <span className="font-medium">{request.requested_weight} kg</span>
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {(rejected || failed || error) && (
                  <Button
                    onClick={() => {
                      resetFlow();
                      setScanning(true);
                    }}
                  >
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
      <QrScannerSheet
        open={scanning}
        onOpenChange={setScanning}
        onResult={(c) => {
          resetFlow();
          setCode(c);
        }}
      />
    </>
  );
}
