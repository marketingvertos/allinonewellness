import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/formatters";
import { BellRing, Check, X } from "lucide-react";
import { MemberModeFilter, usePendingCheckIns, useApproveCheckIn, useRejectCheckIn } from "@/hooks/useWellness";

export function PendingCheckInsCard({ memberMode }: { memberMode?: MemberModeFilter }) {
  const { data: requests, isLoading } = usePendingCheckIns(memberMode);
  const approve = useApproveCheckIn();
  const reject = useRejectCheckIn();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});

  const pending = requests ?? [];

  return (
    <Card className={pending.length ? "border-primary/50" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-primary" />
          Pending check-ins
          {pending.length > 0 && <Badge>{pending.length}</Badge>}
        </CardTitle>
        <CardDescription>
          Member QR scans wait here. A serving is deducted only after you approve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
        {!isLoading && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">No check-ins waiting for approval.</p>
        )}

        {pending.map((r) => {
          const remaining = r.wellness_memberships?.remaining_servings;
          const previous = r.wellness_members?.current_weight ?? null;
          const entered = weights[r.id] ?? (r.requested_weight != null ? String(r.requested_weight) : "");
          const enteredNum = entered ? Number(entered) : null;
          const delta =
            previous != null && enteredNum != null && !Number.isNaN(enteredNum)
              ? enteredNum - previous
              : null;
          return (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.wellness_members?.full_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.wellness_members?.mobile_number} · {formatDateTime(r.requested_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {typeof remaining === "number" ? (
                    <Badge variant={remaining > 0 ? "secondary" : "destructive"}>
                      {remaining} servings left
                    </Badge>
                  ) : (
                    <Badge variant="outline">No active plan</Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Label htmlFor={`weight-${r.id}`} className="text-xs text-muted-foreground">
                  Weight submitted by member (kg)
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`weight-${r.id}`}
                    className="w-24"
                    inputMode="decimal"
                    placeholder={r.requested_weight == null ? "Not entered" : "kg"}
                    value={entered}
                    onChange={(e) => setWeights((w) => ({ ...w, [r.id]: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">
                    {previous != null ? `Last recorded ${previous} kg` : "No previous weight"}
                    {delta != null && Math.abs(delta) > 0
                      ? ` · ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} kg`
                      : ""}
                  </span>
                </div>
              </div>


              {rejecting === r.id ? (
                <div className="mt-3 space-y-2">
                  <Input
                    autoFocus
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={reject.isPending}
                      onClick={async () => {
                        await reject.mutateAsync({ requestId: r.id, reason: reason || undefined });
                        setRejecting(null);
                        setReason("");
                      }}
                    >
                      Confirm reject
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setRejecting(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate({
                        requestId: r.id,
                        weight: enteredNum != null && !Number.isNaN(enteredNum) ? enteredNum : null,
                      })
                    }
                  >
                    <Check className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setRejecting(r.id);
                      setReason("");
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
