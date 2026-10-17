import { describe, expect, it } from "vitest";
import { matchesCapturedPayment } from "../../supabase/functions/_shared/paymentValidation";

const payment = { id: "pay_verified", status: "captured", order_id: "order_verified", amount: 50000, currency: "INR" };
describe("MIW confirmed payment", () => {
  it("accepts a captured ₹500 payment for the matching order", () => expect(matchesCapturedPayment(payment, payment.id, payment.order_id, 50000)).toBe(true));
  it("rejects an unpaid authorization", () => expect(matchesCapturedPayment({ ...payment, status: "authorized" }, payment.id, payment.order_id, 50000)).toBe(false));
  it("rejects another order", () => expect(matchesCapturedPayment(payment, payment.id, "order_other", 50000)).toBe(false));
  it("rejects another payment ID", () => expect(matchesCapturedPayment(payment, "pay_other", payment.order_id, 50000)).toBe(false));
  it("rejects the wrong amount", () => expect(matchesCapturedPayment({ ...payment, amount: 100 }, payment.id, payment.order_id, 50000)).toBe(false));
  it("rejects another currency", () => expect(matchesCapturedPayment({ ...payment, currency: "USD" }, payment.id, payment.order_id, 50000)).toBe(false));
});