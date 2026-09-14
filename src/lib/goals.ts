/** The only two wellness goals the centre works with. */
export const MEMBER_GOALS = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "weight_gain", label: "Weight gain" },
] as const;

export type MemberGoal = (typeof MEMBER_GOALS)[number]["value"];

export function goalLabel(goal: string | null | undefined): string {
  if (!goal) return "";
  return MEMBER_GOALS.find((g) => g.value === goal)?.label ?? "Weight loss";
}
