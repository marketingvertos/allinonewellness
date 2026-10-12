import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWellnessPlans } from "@/hooks/useWellness";
import { PAYMENT_MODES } from "@/hooks/useReports";
import { useToast } from "@/hooks/use-toast";
import { isPaid3, trialChangeError, trialPlanOptions } from "@/lib/trialPlanChange";

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trial: { id: string; plan_id: string | null; duration_days: number | null; name: string };
  visitsUsed: number;
}

export function ChangeTrialPlanDialog({ open, onOpenChange, trial, visitsUsed }: Props) {
  const { data: plans } = useWellnessPlans();
  const options = trialPlanOptions((plans ?? []) as never);
  const currentKey = trial.plan_id ?? `free-${trial.duration_days === 1 ? 1 : 3}`;
  const current = options.find((o) => o.key === currentKey);
  const [key, setKey] = useState(currentKey);
  const [mode, setMode] = useState("cash");
  const [startDate, setStartDate] = useState(istToday());
  const choice = options.find((o) => o.key === key);
  const error = choice ? trialChangeError(visitsUsed, choice) : null;
  const losesCredit = isPaid3(current) && !isPaid3(choice);
  const switchingToPaid = choice && choice.price > 0 && (current ? current.price === 0 : true);
  const qc = useQueryClient();
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: async () => {
      if (!choice) return;
      const { error } = await supabase.rpc("change_trial_plan", {
        p_trial_id: trial.id,
        p_plan_id: choice.planId ?? undefined,
        p_duration_days: choice.durationDays,
        p_payment_mode: choice.price > 0 ? mode : undefined,
        p_start_date: switchingToPaid ? startDate : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wellness-trials"] });
      qc.invalidateQueries({ queryKey: ["trial-attendance"] });
      toast({ title: "Trial plan changed", description: `${trial.name} is now on ${choice?.label}.` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Could not change plan", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change trial plan</DialogTitle>
          <DialogDescription>
            {trial.name} · now on {current?.label ?? "trial"} · {visitsUsed} visit{visitsUsed === 1 ? "" : "s"} used.
            {switchingToPaid ? " Pick a start date for the paid trial." : " Dates are recalculated from the original start date."}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={key} onValueChange={setKey} className="space-y-2">
          {options.map((o) => (
            <Label key={o.key} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
              <RadioGroupItem value={o.key} />
              <span className="flex-1">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.servings} serving{o.servings === 1 ? "" : "s"}</span>
            </Label>
          ))}
        </RadioGroup>
        {switchingToPaid && (
          <div className="space-y-1">
            <Label>Trial start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        )}
        {choice && choice.price > 0 && (
          <div className="space-y-1">
            <Label>Payment mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {losesCredit && !error && (
          <p className="text-sm text-muted-foreground">Moving off the paid 3-day trial takes back the referrer's Pink Card credit.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!choice || key === currentKey || !!error || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Change plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
