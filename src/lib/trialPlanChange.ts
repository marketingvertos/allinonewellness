export interface TrialPlanOption {
  key: string;
  label: string;
  planId: string | null;
  durationDays: number;
  servings: number;
  price: number;
}

/** Free guest options plus every active paid trial plan. */
export function trialPlanOptions(plans: { id: string; name: string; plan_type: string; active: boolean; duration_days: number; total_servings: number; price: number }[]): TrialPlanOption[] {
  const free: TrialPlanOption[] = [
    { key: "free-1", label: "1-day free trial", planId: null, durationDays: 1, servings: 1, price: 0 },
    { key: "free-3", label: "3-day free trial", planId: null, durationDays: 3, servings: 3, price: 0 },
  ];
  const paid = plans
    .filter((p) => p.plan_type === "trial" && p.active && Number(p.price) > 0)
    .map((p) => ({ key: p.id, label: `${p.name} ₹${Number(p.price)}`, planId: p.id, durationDays: p.duration_days, servings: p.total_servings, price: Number(p.price) }));
  return [...free, ...paid];
}

/** Returns an error message when the guest has used more visits than the new plan allows. */
export function trialChangeError(visitsUsed: number, option: TrialPlanOption): string | null {
  if (visitsUsed > option.servings) {
    return `This guest has already used ${visitsUsed} visits; ${option.label} allows only ${option.servings}.`;
  }
  return null;
}

/** Pink Card effect on the referrer: +1 only when moving onto a paid 3-serving trial. */
export function pinkCardDelta(oldPaid3: boolean, newPaid3: boolean): -1 | 0 | 1 {
  if (newPaid3 && !oldPaid3) return 1;
  if (oldPaid3 && !newPaid3) return -1;
  return 0;
}

export const isPaid3 = (o: Pick<TrialPlanOption, "price" | "servings"> | undefined) => !!o && o.price > 0 && o.servings === 3;
