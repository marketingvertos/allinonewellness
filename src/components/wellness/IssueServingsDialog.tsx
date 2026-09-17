import { useEffect, useMemo, useState } from "react";
import { useIssueServings, useMemberships } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Minus, Plus } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      setQty(1);
      setReason("");
    }
  }, [open]);

  const valid = !!membership && qty >= 1 && qty <= remaining;

  const submit = async () => {
    if (!membership) return;
    await issue.mutateAsync({ membershipId: membership.id, quantity: qty, reason: reason.trim() || undefined });
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
