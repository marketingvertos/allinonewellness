import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics, isUmsPlan, paymentDateIst } from "./dashboardMetrics";

const today = "2026-10-02";
const member = (id = "m1", extra = {}) => ({ id, is_guest: false, member_mode: "physical", joining_date: today, ...extra });
const ums = { id: "ums", name: "UMS 30", plan_type: "membership", duration_days: 30, price: 7500 };
const daily = { id: "daily", name: "Daily Paid", plan_type: "day", duration_days: 1, price: 300 };
const trialPlan = { id: "trial", name: "Paid trial", plan_type: "trial", duration_days: 3, price: 500 };
const membership = (id = "s1", extra = {}) => ({
  id, member_id: "m1", plan_id: "ums", start_date: today,
  created_at: "2026-10-02T06:00:00Z", renewed_from: null, status: "active", ...extra,
});
const payment = (extra = {}) => ({
  member_id: "m1", membership_id: "s1", amount: 7500, context: "renewal",
  paid_at: "2026-10-02T06:00:00Z", ...extra,
});
const trial = (extra = {}) => ({
  member_id: "m1", plan_id: null, duration_days: 3, start_date: "2026-10-01",
  end_date: "2026-10-03", status: "active", ...extra,
});
const input = (extra = {}) => ({
  today, mode: "all", members: [member()], plans: [ums, daily, trialPlan],
  memberships: [], payments: [], trials: [], ...extra,
});

describe("dashboard activity counts", () => {
  it("counts first memberships for today and this month, with a UMS 30 subset", () => {
    const result = calculateDashboardMetrics(input({
      members: [member(), member("m2"), member("m3")],
      memberships: [
        membership(),
        membership("s2", { member_id: "m2", start_date: "2026-10-01" }),
        membership("s3", { member_id: "m3", start_date: "2026-09-30" }),
      ],
    }));
    expect(result.newMembersToday).toBe(1);
    expect(result.newMembersThisMonth).toBe(2);
    expect(result.newUms30ThisMonth).toBe(2);
  });

  it("does not count renewals, switches, or repeat purchases as new members", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [
        membership("new", { renewed_from: "old" }),
        membership("old", { start_date: "2026-09-01", created_at: "2026-09-01T06:00:00Z", status: "expired" }),
        membership("repeat"),
      ],
    }));
    expect(result.newMembersThisMonth).toBe(0);
  });

  it("excludes guests, cancelled purchases, and future starts", () => {
    const result = calculateDashboardMetrics(input({
      members: [member("m1", { is_guest: true }), member("m2"), member("m3")],
      memberships: [
        membership(),
        membership("s2", { member_id: "m2", status: "cancelled" }),
        membership("s3", { member_id: "m3", start_date: "2026-10-03", status: "queued" }),
      ],
    }));
    expect(result.newMembersThisMonth).toBe(0);
  });

  it("counts split and extended renewals once, using payment date rather than membership start", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership("s1", { start_date: "2026-09-01", created_at: "2026-09-01T06:00:00Z" })],
      payments: [payment({ amount: 3000 }), payment({ amount: 4500 })],
    }));
    expect(result.umsRenewalsToday).toBe(1);
    expect(result.newMembersToday).toBe(0);
  });

  it("includes queued renewals purchased today", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership("s1", { start_date: "2026-11-01", status: "queued", renewed_from: "old" })],
      payments: [payment()],
    }));
    expect(result.umsRenewalsToday).toBe(1);
    expect(result.newMembersThisMonth).toBe(0);
  });

  it("separates daily renewals and ignores activations, unpaid rows, and backdated payments", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership("s1", { plan_id: "daily" })],
      payments: [
        payment(), payment({ context: "activation" }),
        payment({ amount: 0 }), payment({ paid_at: "2026-10-01T06:00:00Z" }),
      ],
    }));
    expect(result.dailyRenewalsToday).toBe(1);
    expect(result.umsRenewalsToday).toBe(0);
    const excluded = calculateDashboardMetrics(input({
      memberships: [membership()], payments: [
        payment({ context: "activation" }), payment({ amount: 0 }),
        payment({ amount: -1 }), payment({ paid_at: "2026-10-01T06:00:00Z" }),
      ],
    }));
    expect(excluded.umsRenewalsToday).toBe(0);
  });

  it("uses exact IST midnight boundaries", () => {
    expect(paymentDateIst("2026-10-01T18:29:59.999Z")).toBe("2026-10-01");
    expect(paymentDateIst("2026-10-01T18:30:00.000Z")).toBe(today);
    expect(paymentDateIst("2026-10-02T18:29:59.999Z")).toBe(today);
    expect(paymentDateIst("2026-10-02T18:30:00.000Z")).toBe("2026-10-03");
  });

  it("separates active three-day paid, free-plan, and no-plan guest trials", () => {
    const result = calculateDashboardMetrics(input({
      members: [member(), member("m2"), member("m3", { is_guest: true })],
      plans: [trialPlan, { ...trialPlan, id: "free", price: 0 }],
      trials: [
        trial({ plan_id: "trial" }), trial({ plan_id: "trial" }),
        trial({ member_id: "m2", plan_id: "free" }),
        trial({ member_id: "m3" }),
      ],
    }));
    expect(result.paidTrials3Day).toBe(1);
    expect(result.freeTrials3Day).toBe(2);
    expect(result.newGuestsToday).toBe(1);
  });

  it("excludes future, expired, converted, non-three-day, and unknown-plan trials", () => {
    const result = calculateDashboardMetrics(input({ trials: [
      trial({ start_date: "2026-10-03" }), trial({ end_date: "2026-10-01" }),
      trial({ status: "converted" }), trial({ duration_days: 7 }),
      trial({ plan_id: "missing" }), trial({ end_date: null }),
    ] }));
    expect(result.paidTrials3Day).toBe(0);
    expect(result.freeTrials3Day).toBe(0);
  });

  it("includes trials ending today and respects physical/virtual filters", () => {
    const result = calculateDashboardMetrics(input({
      mode: "virtual",
      members: [member(), member("m2", { member_mode: "virtual", is_guest: true })],
      memberships: [membership()], payments: [payment()],
      trials: [trial(), trial({ member_id: "m2", end_date: today })],
    }));
    expect(result.newMembersToday).toBe(0);
    expect(result.umsRenewalsToday).toBe(0);
    expect(result.freeTrials3Day).toBe(1);
    expect(result.newGuestsToday).toBe(1);
  });

  it("classifies UMS from plan metadata, not a discounted payment or serving balance", () => {
    expect(isUmsPlan(ums)).toBe(true);
    expect(isUmsPlan({ ...ums, name: "Monthly membership" })).toBe(true);
    expect(isUmsPlan({ ...ums, name: "Transform 90", duration_days: 90, price: 14500 })).toBe(false);
    expect(isUmsPlan({ ...ums, plan_type: "trial" })).toBe(false);
  });

  it("returns zero counts for empty data", () => {
    const result = calculateDashboardMetrics(input({ members: [] }));
    expect(Object.values(result).every((value) => value === 0)).toBe(true);
  });
});
