import { describe, expect, it } from "vitest";
import { buildSales, summarise, type LedgerPayment } from "./salesLedger";

const pay = (o: Partial<LedgerPayment>): LedgerPayment => ({
  id: "p", membership_id: "m1", member_id: "u1", amount: 0, mode: "cash", reference: null,
  context: "renewal", paid_at: "2026-10-17T00:00:00+00:00", note: null, plan_name: "UMS", plan_type: "membership", ...o,
});

describe("sales ledger", () => {
  it("counts a renewal of an existing membership as renewal revenue", () => {
    const s = summarise(buildSales([pay({ id: "a", amount: 7500 })], []));
    expect(s.renewalRevenue).toBe(7500);
    expect(s.revenue).toBe(7500);
  });

  it("keeps two online payments on the same membership as two sales", () => {
    const sales = buildSales([
      pay({ id: "a", amount: 3750, mode: "online", reference: "pay_1", plan_name: "15 visit Renewal" }),
      pay({ id: "b", amount: 3750, mode: "online", reference: "pay_2", plan_name: "15 Visit-White Card" }),
    ], []);
    expect(sales).toHaveLength(2);
    expect(summarise(sales).byMode.online).toBe(7500);
  });

  it("groups counter split lines into one sale", () => {
    const sales = buildSales([pay({ id: "a", amount: 4000 }), pay({ id: "b", amount: 3500, mode: "upi" })], []);
    expect(sales).toHaveLength(1);
    expect(sales[0].amount).toBe(7500);
  });

  it("falls back to stored price only for memberships without payment lines", () => {
    const legacy = [
      { id: "m1", member_id: "u1", price_paid: 9999, payment_mode: "cash", renewed_from: null, created_at: "2026-10-17", plan_name: "UMS", plan_type: "membership" },
      { id: "m2", member_id: "u2", price_paid: 3750, payment_mode: "cash", renewed_from: null, created_at: "2026-10-17", plan_name: "White", plan_type: "membership" },
    ];
    const s = summarise(buildSales([pay({ id: "a", amount: 7500 })], legacy));
    expect(s.revenue).toBe(11250);
    expect(s.newRevenue).toBe(3750);
  });
});

import { pickPaymentPlan } from "./salesLedger";
describe("pickPaymentPlan", () => {
  it("renewal payment tagged NEW shows the membership's renewal plan", () => {
    expect(pickPaymentPlan("renewal", { name: "NEW Gold Card UMS-7500" }, { name: "RENEWAL -7500-GOLD CARD UMS" })!.name).toBe("RENEWAL -7500-GOLD CARD UMS");
  });
  it("new payment keeps its NEW plan", () => {
    expect(pickPaymentPlan("activation", { name: "NEW Gold Card UMS-7500" }, { name: "RENEWAL -7500-GOLD CARD UMS" })!.name).toBe("NEW Gold Card UMS-7500");
  });
});
