import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, ScanLine, Trophy, X } from "lucide-react";
import { useApproveCheckIn, useRejectCheckIn } from "@/hooks/useWellness";
import { RealtimeAlert, useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { MemberSheetById } from "./MemberSheetById";
import { cn } from "@/lib/utils";

export function RealtimeAlertStack() {
  const { alerts, dismiss } = useRealtimeAlerts(true);
  const [profile, setProfile] = useState<string | null>(null);
  const visible = alerts.slice(0, 3);
  const extra = alerts.length - visible.length;

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-2">
        {visible.map((a) =>
          a.kind === "checkin" ? (
            <CheckinCard key={a.id} alert={a} onClose={() => dismiss(a.id)} onProfile={() => setProfile(a.memberId)} />
          ) : (
            <MilestoneCard key={a.id} alert={a} onClose={() => dismiss(a.id)} onProfile={() => setProfile(a.memberId)} />
          ),
        )}
        {extra > 0 && (
          <p className="pointer-events-auto rounded-md border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow">
            +{extra} more waiting
          </p>
        )}
      </div>
      <MemberSheetById memberId={profile} onClose={() => setProfile(null)} />
    </>
  );
}

const shell = "pointer-events-auto animate-in slide-in-from-right-8 fade-in rounded-lg border bg-card p-3 shadow-lg";

function CheckinCard({ alert, onClose, onProfile }: {
  alert: Extract<RealtimeAlert, { kind: "checkin" }>; onClose: () => void; onProfile: () => void;
}) {
  const approve = useApproveCheckIn();
  const reject = useRejectCheckIn();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<null | "approved" | "rejected">(null);
  const busy = approve.isPending || reject.isPending;
  const change =
    alert.requestedWeight != null && alert.lastWeight != null
      ? Math.round((alert.requestedWeight - alert.lastWeight) * 10) / 10
      : null;

  const finish = (s: "approved" | "rejected") => {
    setDone(s);
    setTimeout(onClose, 1200);
  };

  return (
    <div className={cn(shell, "border-l-4 border-l-primary")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <ScanLine className="h-4 w-4" /> Check-in request
        </div>
        <button aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <button onClick={onProfile} className="mt-1 block text-left font-semibold hover:underline">{alert.name}</button>
      <p className="text-xs text-muted-foreground">{alert.mobile}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Weight" value={alert.requestedWeight != null ? `${alert.requestedWeight} kg` : "—"} />
        <Stat label="Last" value={alert.lastWeight != null ? `${alert.lastWeight} kg` : "—"}
          sub={change != null ? `${change > 0 ? "+" : ""}${change} kg` : undefined} />
        <Stat label="Servings left" value={alert.remaining ?? "—"} />
      </div>

      {done ? (
        <p className={cn("mt-3 flex items-center gap-1 text-sm font-medium", done === "approved" ? "text-primary" : "text-destructive")}>
          {done === "approved" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {done === "approved" ? "Approved!" : "Rejected"}
        </p>
      ) : rejecting ? (
        <div className="mt-3 space-y-2">
          <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRejecting(false)} disabled={busy}>Back</Button>
            <Button size="sm" variant="destructive" className="flex-1" disabled={busy}
              onClick={() => reject.mutate({ requestId: alert.id, reason: reason.trim() || undefined }, { onSuccess: () => finish("rejected") })}>
              {reject.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Confirm reject
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>Reject</Button>
          <Button size="sm" className="flex-1" disabled={busy}
            onClick={() => approve.mutate({ requestId: alert.id, weight: alert.requestedWeight }, {
              onSuccess: (r) => { if (r?.status === "ok") finish("approved"); },
            })}>
            {approve.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Approve
          </Button>
        </div>
      )}
    </div>
  );
}

function MilestoneCard({ alert, onClose, onProfile }: {
  alert: Extract<RealtimeAlert, { kind: "milestone" }>; onClose: () => void; onProfile: () => void;
}) {
  return (
    <div className={cn(shell, "border-l-4 border-l-accent")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent-foreground">
          <Trophy className="h-4 w-4" /> Milestone unlocked
        </div>
        <button aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm">
        <span className="mr-1">{alert.icon}</span>
        <span className="font-semibold">{alert.name}</span> unlocked <span className="font-semibold">{alert.milestone}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" className="flex-1" onClick={onClose}>Dismiss</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onProfile}>View profile</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
