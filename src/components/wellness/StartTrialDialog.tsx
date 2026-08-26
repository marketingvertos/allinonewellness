import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStartTrial, useWellnessPlans, WellnessMember } from "@/hooks/useWellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  member: WellnessMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_PLAN = "__none__";

export function StartTrialDialog({ member, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: plans } = useWellnessPlans();
  const startTrial = useStartTrial();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [planId, setPlanId] = useState<string>(NO_PLAN);
  const [days, setDays] = useState("3");
  const [startDate, setStartDate] = useState(today);
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (open) {
      setPlanId(NO_PLAN);
      setDays("3");
      setStartDate(today);
      setWeight(member.current_weight ? String(member.current_weight) : "");
    }
  }, [open, member.current_weight, today]);

  const trialPlans = (plans ?? []).filter((p) => p.plan_type === "trial");

  const pickPlan = (id: string) => {
    setPlanId(id);
    const plan = trialPlans.find((p) => p.id === id);
    if (plan) setDays(String(plan.duration_days));
  };

  const submit = async () => {
    if (!user) return;
    const duration = Math.max(1, Number(days) || 1);
    const end = new Date(`${startDate}T00:00:00`);
    end.setDate(end.getDate() + duration);
    await startTrial.mutateAsync({
      member_id: member.id,
      plan_id: planId === NO_PLAN ? null : planId,
      start_date: startDate,
      duration_days: duration,
      end_date: end.toLocaleDateString("en-CA"),
      weight_at_start: weight ? Number(weight) : null,
      status: "active",
      created_by: user.id,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Start trial for ${member.full_name}`}
      description="Trial visits are tracked as attendance without deducting servings."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={startTrial.isPending}>
            Start trial
          </Button>
        </>
      }
    >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label>Trial plan (optional)</Label>
            <Select value={planId} onValueChange={pickPlan}>
              <SelectTrigger>
                <SelectValue placeholder="No plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>No plan — custom trial</SelectItem>
                {trialPlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.duration_days} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-start">Start date</Label>
            <Input id="t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-days">Duration (days)</Label>
            <Input id="t-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-weight">Weight at start (kg)</Label>
            <Input id="t-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
    </ResponsiveDialog>
  );
}
