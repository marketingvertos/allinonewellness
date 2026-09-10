import { useEffect, useState } from "react";
import {
  PINK_CARD_SERVING_VALUE,
  RenewMode,
  WellnessMembership,
  useRedeemPinkCard,
  useRenewPlan,
  useWellnessMember,
  useWellnessPlans,
} from "@/hooks/useWellness";
import { Switch } from "@/components/ui/switch";
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
  const [usePink, setUsePink] = useState(false);
  const [pinkCredits, setPinkCredits] = useState(0);

  const plan = membershipPlans.find((p) => p.id === planId);
  const { data: member } = useWellnessMember(membership.member_id);
  const redeemPink = useRedeemPinkCard();
  const pinkBalance = member?.pink_card_balance ?? 0;
  const planPrice = plan ? Number(plan.price) : 0;
  const maxCredits = Math.min(pinkBalance, Math.floor(planPrice / PINK_CARD_SERVING_VALUE));
  const discount = Math.min(pinkCredits * PINK_CARD_SERVING_VALUE, planPrice);

  useEffect(() => {
    if (!open) return;
    setPlanId(membership.plan_id);
    setMode("extend");
    setNote("");
    setUsePink(false);
    setPinkCredits(0);
  }, [open, membership]);

  useEffect(() => {
    if (plan) {
      setServings(plan.total_servings);
      setPrice(String(plan.price));
    }
  }, [plan]);

  // Keep the collected amount in step with the Pink Card discount.
  useEffect(() => {
    if (!plan) return;
    const credits = usePink ? Math.min(pinkCredits, maxCredits) : 0;
    setPinkCredits((c) => Math.min(c, maxCredits));
    setPrice(String(Math.max(Number(plan.price) - credits * PINK_CARD_SERVING_VALUE, 0)));
  }, [usePink, pinkCredits, maxCredits, plan]);

  useEffect(() => {
    if (usePink && pinkCredits === 0 && maxCredits > 0) setPinkCredits(maxCredits);
  }, [usePink, maxCredits, pinkCredits]);

  const submit = async () => {
    await renew.mutateAsync({
      membershipId: membership.id,
      planId,
      servings,
      price: price === "" ? null : Number(price),
      mode,
      note: note.trim() || null,
    });
    if (usePink && pinkCredits > 0) {
      await redeemPink.mutateAsync({
        memberId: membership.member_id,
        credits: pinkCredits,
        membershipId: membership.id,
        note: `Renewal discount ${discount}`,
      });
    }
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

        {pinkBalance > 0 && (
          <div className="space-y-3 rounded-md border border-[hsl(330_70%_55%/0.4)] bg-[hsl(330_70%_55%/0.06)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[hsl(330_70%_45%)]">
                  Pink Card: {pinkBalance} serving{pinkBalance === 1 ? "" : "s"} available ·{" "}
                  {formatCurrency(pinkBalance * PINK_CARD_SERVING_VALUE)} credit
                </p>
                <p className="text-xs text-muted-foreground">Apply as a discount on this renewal.</p>
              </div>
              <Switch checked={usePink} onCheckedChange={setUsePink} disabled={maxCredits === 0} />
            </div>
            {usePink && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="icon" variant="outline" onClick={() => setPinkCredits((c) => Math.max(0, c - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  className="w-20 text-center"
                  inputMode="numeric"
                  value={pinkCredits}
                  onChange={(e) =>
                    setPinkCredits(Math.min(maxCredits, Number(e.target.value.replace(/\D/g, "")) || 0))
                  }
                />
                <Button type="button" size="icon" variant="outline" onClick={() => setPinkCredits((c) => Math.min(maxCredits, c + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Discount <span className="font-semibold">{formatCurrency(discount)}</span> · Amount to collect{" "}
                  <span className="font-semibold">{formatCurrency(Math.max(planPrice - discount, 0))}</span>
                </span>
              </div>
            )}
          </div>
        )}

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

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {mode === "extend" && (
            <p>
              <span className="font-medium">{membership.remaining_servings} left</span> + {servings} new ={" "}
              <span className="font-semibold">{membership.remaining_servings + servings} servings</span>
              {plan ? ` · plan extended by ${plan.duration_days} days` : ""}
            </p>
          )}
          {mode === "queue" && (
            <p>
              The current {membership.remaining_servings} serving
              {membership.remaining_servings === 1 ? "" : "s"} are used first, then {servings} more start
              automatically.
            </p>
          )}
          {mode === "replace" && (
            <p>
              New balance will be <span className="font-semibold">{servings} servings</span>
              {membership.remaining_servings > 0
                ? ` — ${membership.remaining_servings} unused serving${membership.remaining_servings === 1 ? "" : "s"} dropped.`
                : "."}
            </p>
          )}
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
