import { describe, it, expect } from "vitest";
import { MIW_DEFAULT_FEE, miwEndDate, miwDay, miwChange } from "./miw";
import { buildSales, summarise, type LedgerPayment } from "./salesLedger";

describe("MIW rules", () => {
  it("defaults to a ₹500 registration", () => expect(MIW_DEFAULT_FEE).toBe(500));
  it("spans 21 inclusive days across months", () => expect(miwEndDate("2026-10-17")).toBe("2026-11-06"));
  it("shows day 21 on the final day", () => expect(miwDay("2026-10-17", "2026-11-06")).toBe(21));
  it("calculates 2.5 kg lost from existing readings", () => expect(miwChange(80, 77.5)).toBe(-2.5));
  it("does not invent a change when baseline is missing", () => expect(miwChange(null, 77.5)).toBeNull());
  const p: LedgerPayment = { id: "p1", membership_id: "", registration_id: "r1", member_id: "u1", amount: 500, mode: "cash", reference: null, context: "miw", paid_at: "2026-10-17T10:00:00Z", note: null, plan_name: "MIW", plan_type: "miw" };
  it("counts MIW separately from membership revenue", () => {
    const result = summarise(buildSales([p], []));
    expect(result.revenue).toBe(500); expect(result.miwRevenue).toBe(500);
    expect(result.newRevenue + result.renewalRevenue + result.trialRevenue).toBe(0);
  });
  it("never groups registrations for different members", () => expect(buildSales([p, { ...p, id: "p2", registration_id: "r2", member_id: "u2" }], [])).toHaveLength(2));
});