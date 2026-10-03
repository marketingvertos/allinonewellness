import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { PINK_CARD_SERVING_VALUE, useWellnessPlans } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { formatCurrency, planGetsBonus } from "@/lib/formatters";
import { cn } from "@/lib/utils";

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
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-11 w-full shrink-0 sm:w-auto" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-12 w-full text-base sm:w-auto" onClick={pay} disabled={!plan || busy || amount <= 0}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening…
              </>
            ) : (
              `Pay ${formatCurrency(amount)}`
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Choose your plan</Label>
          <div className="space-y-2" role="radiogroup" aria-label="Plan">
            {payable.map((p) => {
              const selected = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    "flex w-full min-h-[4rem] items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">{p.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.total_servings} servings{planGetsBonus(p) ? " + 2 bonus" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cn("text-sm font-semibold", selected && "text-primary")}>
                      {formatCurrency(Number(p.price))}
                    </span>
                    {selected && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {maxCredits > 0 && (
          <div
            role="switch"
            aria-checked={usePink}
            onClick={() => setUsePink((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[hsl(330_70%_55%/0.4)] bg-[hsl(330_70%_55%/0.06)] p-4 text-left transition-colors active:bg-[hsl(330_70%_55%/0.12)]"
          >
            <span>
              <span className="block text-sm font-semibold text-[hsl(330_70%_45%)]">
                Use Pink Card credit — {maxCredits} serving{maxCredits === 1 ? "" : "s"} ·{" "}
                {formatCurrency(maxCredits * PINK_CARD_SERVING_VALUE)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Tap to switch on or off. Taken off before you pay.</span>
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Switch checked={usePink} onCheckedChange={setUsePink} />
            </span>
          </div>
        )}

        <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Plan amount</span>
            <span>{formatCurrency(price)}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-sm text-[hsl(330_70%_45%)]">
              <span>Pink Card discount</span>
              <span>− {formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-sm font-medium">To pay now</span>
            <span className="text-xl font-bold">{formatCurrency(amount)}</span>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
