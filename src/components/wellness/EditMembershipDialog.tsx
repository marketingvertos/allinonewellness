import { useEffect, useState } from "react";
import {
  WellnessMembership,
  useUpdateMembership,
  useWellnessPlans,
} from "@/hooks/useWellness";
import { PAYMENT_MODES } from "@/hooks/useReports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DobInput } from "@/components/ui/dob-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  membership: WellnessMembership;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMembershipDialog({ membership, open, onOpenChange }: Props) {
  const { data: plans } = useWellnessPlans(false);
  const update = useUpdateMembership();

  const [planId, setPlanId] = useState(membership.plan_id);
  const [startDate, setStartDate] = useState(membership.start_date ?? "");
  const [endDate, setEndDate] = useState(membership.end_date ?? "");
  const [total, setTotal] = useState(String(membership.total_servings ?? 0));
  const [remaining, setRemaining] = useState(String(membership.remaining_servings ?? 0));
  const [price, setPrice] = useState(String(membership.price_paid ?? ""));
  const [payMode, setPayMode] = useState(
    (membership as { payment_mode?: string | null }).payment_mode ?? "cash",
  );
  const [payDate, setPayDate] = useState(
    (membership as { payment_date?: string | null }).payment_date ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setPlanId(membership.plan_id);
    setStartDate(membership.start_date ?? "");
    setEndDate(membership.end_date ?? "");
    setTotal(String(membership.total_servings ?? 0));
    setRemaining(String(membership.remaining_servings ?? 0));
    setPrice(String(membership.price_paid ?? ""));
    setPayMode((membership as { payment_mode?: string | null }).payment_mode ?? "cash");
    setPayDate((membership as { payment_date?: string | null }).payment_date ?? "");
  }, [open, membership]);

  const save = async () => {
    await update.mutateAsync({
      membershipId: membership.id,
      planId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      totalServings: total === "" ? undefined : Number(total),
      remainingServings: remaining === "" ? undefined : Number(remaining),
      price: price === "" ? undefined : Number(price),
      paymentMode: payMode,
      paymentDate: payDate || undefined,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit membership"
      description="Correct the plan, dates, payment details or servings for this membership."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
            <SelectContent>
              {plans?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-start">Start date</Label>
          <DobInput id="ed-start" showAge={false} value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-end">End date</Label>
          <DobInput id="ed-end" showAge={false} value={endDate} onChange={setEndDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-total">Total servings</Label>
          <Input id="ed-total" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-remaining">Servings remaining</Label>
          <Input id="ed-remaining" inputMode="numeric" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ed-price">Amount collected</Label>
          <Input id="ed-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select value={payMode} onValueChange={setPayMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ed-paydate">Payment date</Label>
          <DobInput id="ed-paydate" showAge={false} value={payDate} onChange={setPayDate} />
        </div>

        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Any change to the servings remaining is recorded in the member's serving history.
        </p>
      </div>
    </ResponsiveDialog>
  );
}
