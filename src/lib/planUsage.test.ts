import { describe, expect, it } from "vitest";
import { plansForNew, plansForRenewal } from "./planUsage";

const plans = [
  { name: "3 Days Free Trial", plan_usage: "new", active: true },
  { name: "3-Day Paid Trial", plan_usage: "new", active: true },
  { name: "15 Visit-White Card", plan_usage: "new", active: true },
  { name: "NEW Gold Card UMS-7500", plan_usage: "new", active: true },
  { name: "3 Days Renewal-750", plan_usage: "renewal", active: true },
  { name: "15 visit Renewal", plan_usage: "renewal", active: true },
  { name: "RENEWAL -7500-GOLD CARD UMS", plan_usage: "renewal", active: true },
  { name: "Daily Paid", plan_usage: "guest", active: true },
];

describe("plan lists", () => {
  it("first-time buyers see only the four new-member plans", () => {
    expect(plansForNew(plans).map((p) => p.name)).toEqual([
      "3 Days Free Trial", "3-Day Paid Trial", "15 Visit-White Card", "NEW Gold Card UMS-7500",
    ]);
  });
  it("renewing members see only the three renewal plans", () => {
    expect(plansForRenewal(plans).map((p) => p.name)).toEqual([
      "3 Days Renewal-750", "15 visit Renewal", "RENEWAL -7500-GOLD CARD UMS",
    ]);
  });
});
