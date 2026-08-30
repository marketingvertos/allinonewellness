import { useEffect, useState } from "react";
import { RenewMode, WellnessMembership, useRenewPlan, useWellnessPlans } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Minus, Plus } from "lucide-react";

interface Props {
  membership: WellnessMembership;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenewPlanDialog({ membership, open, onOpenChange }: Props) {
  const { data: plans } = useWellnessPlans();
  const renew = useRenewPlan();
  const membershipPlans = (plans ?? []).filter((p) => p.plan_type === "membership");

  const [planId, setPlanId] = useState(membership.plan_id);
  const [servings, setServings] = useState<number>(0);
  const [price, setPrice] = useState<string>("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<RenewMode>("extend");

  const plan = membershipPlans.find((p) => p.id === planId);

  useEffect(() => {
    if (!open) return;
    setPlanId(membership.plan_id);
    setMode(membership.remaining_servings > 0 ? "queue" : "replace");
    setNote("");
  }, [open, membership]);

  useEffect(() => {
    if (plan) {
      setServings(plan.total_servings);
      setPrice(String(plan.price));
    }
  }, [plan]);

  const submit = async () => {
    await renew.mutateAsync({
      membershipId: membership.id,
      planId,
      servings,
      price: price === "" ? null : Number(price),
      mode,
      note: note.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Renew plan"
      description={`${membership.remaining_servings} serving${membership.remaining_servings === 1 ? "" : "s"} still left on the current plan (ends ${formatDate(membership.end_date)}).`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!planId || renew.isPending}>Confirm renewal</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Renewal plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
            <SelectContent>
              {membershipPlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(Number(p.price))} · {p.total_servings} servings
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Servings on this renewal</Label>
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="outline" onClick={() => setServings((s) => Math.max(0, s - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                className="text-center"
                inputMode="numeric"
                value={servings}
                onChange={(e) => setServings(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
              />
              <Button type="button" size="icon" variant="outline" onClick={() => setServings((s) => s + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {plan && servings !== plan.total_servings && (
              <p className="text-xs text-muted-foreground">Plan default is {plan.total_servings} servings.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-price">Amount collected</Label>
            <Input id="rp-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>How should it apply?</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as RenewMode)} className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <RadioGroupItem value="queue" className="mt-1" />
              <span>
                <span className="font-medium">Queue after the current plan</span>
                <span className="block text-xs text-muted-foreground">
                  The remaining {membership.remaining_servings} serving
                  {membership.remaining_servings === 1 ? "" : "s"} are used first. The new plan starts automatically
                  once they run out or the plan ends.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <RadioGroupItem value="extend" className="mt-1" />
              <span>
                <span className="font-medium">Add to the current plan</span>
                <span className="block text-xs text-muted-foreground">
                  Servings and days are added onto the running plan — one combined balance of{" "}
                  {membership.remaining_servings + servings} servings.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <RadioGroupItem value="replace" className="mt-1" />
              <span>
                <span className="font-medium">Replace the current plan now</span>
                <span className="block text-xs text-destructive">
                  {membership.remaining_servings > 0
                    ? `${membership.remaining_servings} unused serving${membership.remaining_servings === 1 ? "" : "s"} will be lost.`
                    : "Starts fresh today."}
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp-note">Note (optional)</Label>
          <Input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recorded on the serving ledger" />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
