import { useEffect, useState } from "react";
import { WellnessMembership, useSwitchPlan, useWellnessPlans } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  membership: WellnessMembership;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SwitchPlanDialog({ membership, open, onOpenChange }: Props) {
  const { data: plans } = useWellnessPlans();
  const switchPlan = useSwitchPlan();
  const membershipPlans = (plans ?? []).filter((p) => p.plan_type === "membership" && p.id !== membership.plan_id);

  const [planId, setPlanId] = useState("");
  const [carry, setCarry] = useState("carry");
  const [price, setPrice] = useState("");

  const plan = membershipPlans.find((p) => p.id === planId);

  useEffect(() => {
    if (!open) return;
    setPlanId("");
    setCarry("carry");
    setPrice("");
  }, [open]);

  useEffect(() => {
    if (plan) setPrice(String(plan.price));
  }, [plan]);

  const submit = async () => {
    await switchPlan.mutateAsync({
      membershipId: membership.id,
      planId,
      carryServings: carry === "carry",
      price: price === "" ? null : Number(price),
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Switch plan"
      description="Move this member onto a different plan straight away."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!planId || switchPlan.isPending}>Switch plan</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>New plan</Label>
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

        <div className="space-y-2">
          <Label>What happens to the {membership.remaining_servings} remaining serving{membership.remaining_servings === 1 ? "" : "s"}?</Label>
          <RadioGroup value={carry} onValueChange={setCarry} className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <RadioGroupItem value="carry" className="mt-1" />
              <span>
                <span className="font-medium">Carry them over</span>
                <span className="block text-xs text-muted-foreground">
                  Added to the new plan{plan ? ` — ${plan.total_servings + membership.remaining_servings} servings in total` : ""}.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <RadioGroupItem value="queue" className="mt-1" />
              <span>
                <span className="font-medium">Keep them queued</span>
                <span className="block text-xs text-muted-foreground">
                  The old plan waits in the queue and resumes once the new plan is used up.
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sp-price">Amount collected</Label>
          <Input id="sp-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
