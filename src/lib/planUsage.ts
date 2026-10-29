export type PlanUsage = "new" | "renewal" | "both" | "guest";

interface UsagePlan {
  active?: boolean | null;
  plan_usage?: string | null;
}

const usageOf = (p: UsagePlan): PlanUsage => (p.plan_usage as PlanUsage) ?? "both";

/** Plans offered to someone buying for the first time (guest, lead, trial conversion). */
export function plansForNew<T extends UsagePlan>(plans: T[]): T[] {
  return plans.filter((p) => p.active !== false && ["new", "both"].includes(usageOf(p)));
}

/** Plans offered when an existing member renews. */
export function plansForRenewal<T extends UsagePlan>(plans: T[]): T[] {
  return plans.filter((p) => p.active !== false && ["renewal", "both"].includes(usageOf(p)));
}

export const PLAN_USAGE_LABEL: Record<PlanUsage, string> = {
  new: "New members",
  renewal: "Renewals",
  both: "New & renewals",
  guest: "Guest only",
};
