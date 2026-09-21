import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PINK_CARD_SERVING_VALUE, useWellnessPlans } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  pinkBalance: number;
  /** Pre-selected plan, usually the one the member is currently on. */
  defaultPlanId?: string | null;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** Loads the Razorpay checkout script the first time a member pays. */
function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PayOnlineDialog({ open, onOpenChange, memberName, pinkBalance, defaultPlanId }: Props) {
  const { data: plans } = useWellnessPlans();
  const qc = useQueryClient();
  const payable = (plans ?? []).filter((p) => Number(p.price) > 0);

  const [planId, setPlanId] = useState<string>("");
  const [usePink, setUsePink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsePink(false);
    setBusy(false);
    setPlanId(defaultPlanId && payable.some((p) => p.id === defaultPlanId) ? defaultPlanId : payable[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPlanId, plans]);

  const plan = payable.find((p) => p.id === planId);
  const price = plan ? Number(plan.price) : 0;
  const maxCredits = useMemo(
    () => Math.min(pinkBalance, Math.floor(price / PINK_CARD_SERVING_VALUE)),
    [pinkBalance, price],
  );
  const credits = usePink ? maxCredits : 0;
  const discount = credits * PINK_CARD_SERVING_VALUE;
  const amount = Math.max(price - discount, 0);

  const pay = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const ready = await loadCheckout();
      if (!ready) throw new Error("Could not open the payment screen. Check your internet and try again.");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { planId: plan.id, pinkCredits: credits },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const rzp = new window.Razorpay!({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amountPaise,
        currency: "INR",
        name: "All in One Wellness",
        description: data.planName,
        prefill: {
          name: data.member?.name ?? memberName,
          email: data.member?.email || undefined,
          contact: data.member?.contact || undefined,
        },
        theme: { color: "#16a34a" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.info("Payment cancelled — nothing was charged.");
          },
        },
        handler: async (res: RazorpayResponse) => {
          try {
            const { data: vd, error: ve } = await supabase.functions.invoke("razorpay-verify", {
              body: {
                orderId: data.orderId,
                razorpayOrderId: res.razorpay_order_id,
                razorpayPaymentId: res.razorpay_payment_id,
                razorpaySignature: res.razorpay_signature,
              },
            });
            if (ve) throw new Error(ve.message);
            if (vd?.error) throw new Error(vd.error);
            toast.success("Payment received — your plan is active.");
            qc.invalidateQueries();
            onOpenChange(false);
          } catch (err) {
            toast.error(
              "Payment went through, but we could not update your plan yet. It will update shortly — please contact the centre if it does not.",
            );
            console.error(err);
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      toast.error((e as Error).message ?? "Could not start the payment.");
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pay online"
      description="Pay for your plan by UPI, card, netbanking or wallet."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={pay} disabled={!plan || busy || amount <= 0}>
            {busy ? "Opening…" : `Pay ${formatCurrency(amount)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
            <SelectContent>
              {payable.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(Number(p.price))} · {p.total_servings} servings
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {maxCredits > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-[hsl(330_70%_55%/0.4)] bg-[hsl(330_70%_55%/0.06)] p-3">
            <div>
              <p className="text-sm font-medium text-[hsl(330_70%_45%)]">
                Use Pink Card credit — {maxCredits} serving{maxCredits === 1 ? "" : "s"} ·{" "}
                {formatCurrency(maxCredits * PINK_CARD_SERVING_VALUE)}
              </p>
              <p className="text-xs text-muted-foreground">Taken off before you pay.</p>
            </div>
            <Switch checked={usePink} onCheckedChange={setUsePink} />
          </div>
        )}

        <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span>Plan amount</span><span>{formatCurrency(price)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-[hsl(330_70%_45%)]">
              <span>Pink Card discount</span><span>− {formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>To pay now</span><span>{formatCurrency(amount)}</span>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
