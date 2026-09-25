import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useIssueServings, useMemberAttendanceOnDates, useMemberships } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { CalendarIcon, Minus, Plus } from "lucide-react";
import { todayIst } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const isoToLocal = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addIsoDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
}

export function IssueServingsDialog({ open, onOpenChange, memberId, memberName }: Props) {
  const { data: memberships } = useMemberships(open ? memberId : undefined);
  const issue = useIssueServings();

  const membership = useMemo(
    () => (memberships ?? []).find((m) => m.status === "active" || m.status === "expiring_soon"),
    [memberships],
  );
  const remaining = membership?.remaining_servings ?? 0;

  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [dates, setDates] = useState<string[]>([todayIst()]);

  useEffect(() => {
    if (open) {
      setQty(1);
      setReason("");
      setDates([todayIst()]);
    }
  }, [open]);

  // Keep one date per serving; new rows continue after the last picked date.
  useEffect(() => {
    setDates((prev) => {
      if (prev.length === qty) return prev;
      if (prev.length > qty) return prev.slice(0, qty);
      const next = [...prev];
      while (next.length < qty) {
        let d = addIsoDays(next[next.length - 1] ?? todayIst(), 1);
        while (next.includes(d)) d = addIsoDays(d, 1);
        next.push(d);
      }
      return next;
    });
  }, [qty]);

  const { data: existing } = useMemberAttendanceOnDates(open ? memberId : undefined, dates);
  const unique = new Set(dates).size === dates.length;
  const valid = !!membership && qty >= 1 && qty <= remaining && unique && dates.length === qty;

  const submit = async () => {
    if (!membership) return;
    await issue.mutateAsync({ membershipId: membership.id, quantity: qty, reason: reason.trim() || undefined, dates });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Issue servings"
      description={`Pack and hand over servings for ${memberName}.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || issue.isPending} onClick={submit}>
            {`Issue ${qty} serving${qty === 1 ? "" : "s"}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {membership ? (
          <>
            <p className="text-sm text-muted-foreground">
              {membership.wellness_plans?.name ?? "Membership"} · {remaining} of {membership.total_servings}{" "}
              servings remaining
            </p>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  className="w-20 text-center"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ""));
                    setQty(Math.min(Math.max(n || 1, 1), Math.max(remaining, 1)));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={qty >= remaining}
                  onClick={() => setQty((q) => Math.min(remaining, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Serving dates ({qty} {qty === 1 ? "day" : "days"})
              </Label>
              <p className="text-xs text-muted-foreground">
                Each date is marked present (serving issued) in the attendance register.
              </p>
              <div className="grid gap-2">
                {dates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-12 text-xs text-muted-foreground">Day {i + 1}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start font-normal">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {format(isoToLocal(d), "EEE, dd MMM yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={isoToLocal(d)}
                          onSelect={(v) => {
                            if (!v) return;
                            const iso = format(v, "yyyy-MM-dd");
                            setDates((prev) => prev.map((x, j) => (j === i ? iso : x)));
                          }}
                          disabled={(v) => dates.some((x, j) => j !== i && x === format(v, "yyyy-MM-dd"))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {existing?.has(d) && (
                      <span className="text-[11px] text-muted-foreground">Already present, skipped</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-reason">Reason (optional)</Label>
              <Input
                id="issue-reason"
                placeholder="Travelling · Packed for family · Home delivery"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              After issuing: <span className="font-semibold">{Math.max(remaining - qty, 0)}</span> servings remaining
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This member has no active plan, so servings cannot be issued.
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
