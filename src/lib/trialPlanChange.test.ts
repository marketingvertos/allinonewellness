import { describe, expect, it } from "vitest";
import { pinkCardDelta, trialChangeError, trialPlanOptions } from "./trialPlanChange";

const plans = [
  { id: "p3", name: "3-Day Paid Trial", plan_type: "trial", active: true, duration_days: 3, total_servings: 3, price: 750 },
  { id: "d1", name: "Daily Paid", plan_type: "trial", active: true, duration_days: 1, total_servings: 1, price: 300 },
  { id: "old", name: "3 Days Free Trial", plan_type: "trial", active: false, duration_days: 3, total_servings: 3, price: 0 },
  { id: "g", name: "Gold", plan_type: "membership", active: true, duration_days: 30, total_servings: 30, price: 7500 },
];

describe("trial plan change", () => {
  it("offers free 1/3-day plus active paid trial plans only", () => {
    expect(trialPlanOptions(plans).map((o) => o.key)).toEqual(["free-1", "free-3", "p3", "d1"]);
  });
  it("blocks moving to 1-day when 2 visits are used", () => {
    const oneDay = trialPlanOptions(plans)[0];
    expect(trialChangeError(2, oneDay)).not.toBeNull();
    expect(trialChangeError(1, oneDay)).toBeNull();
  });
  it("free to paid 3-day gives referrer +1, paid to free takes it back", () => {
    expect(pinkCardDelta(false, true)).toBe(1);
    expect(pinkCardDelta(true, false)).toBe(-1);
    expect(pinkCardDelta(false, false)).toBe(0);
  });
});
