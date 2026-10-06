import { describe, expect, it } from "vitest";
import {
  calculateDashboardMetrics,
  DASHBOARD_CARD_KEYS,
  isGoldCardPlan,
  isPaid3DayTrialPlan,
  isWhiteCardPlan,
  paymentDateIst,
  type DashboardMetricInput,
} from "./dashboardMetrics";

const today = "2026-10-02";
const yesterday = "2026-10-01";
const member = (id = "m1", extra = {}) => ({ id, is_guest: false, member_mode: "physical", joining_date: today, ...extra });
const gold = { id: "gold", name: "NEW Gold Card UMS-7500", plan_type: "membership", duration_days: 30, total_servings: 30, price: 7500 };
const white = { id: "white", name: "15 Visit-White Card", plan_type: "membership", duration_days: 15, total_servings: 15, price: 3750 };
const paid3 = { id: "paid3", name: "3-Day Paid Trial", plan_type: "trial", duration_days: 3, total_servings: 3, price: 750 };
const dailyPaid = { id: "daily", name: "Daily Paid", plan_type: "trial", duration_days: 1, total_servings: 1, price: 300 };
const membership = (id = "s1", extra = {}) => ({
  id, member_id: "m1", plan_id: "gold", start_date: today,
  created_at: "2026-10-02T06:00:00Z", renewed_from: null, status: "active", ...extra,
});
const payment = (extra = {}) => ({
  member_id: "m1", membership_id: "s1", amount: 7500, context: "renewal",
  paid_at: "2026-10-02T06:00:00Z", ...extra,
});
const trial = (extra = {}) => ({
  id: "t1", member_id: "m1", plan_id: null, duration_days: 3, start_date: today,
  end_date: "2026-10-04", status: "active", ...extra,
});
const attendance = (extra = {}) => ({ member_id: "m1", trial_id: "t1", visit_date: today, ...extra });
const input = (extra = {}) => ({
  today, mode: "all", members: [member()], plans: [gold, white, paid3, dailyPaid],
  memberships: [], payments: [], trials: [], attendance: [], ...extra,
}) as unknown as DashboardMetricInput;

const countsOf = (result: { lists: Record<string, unknown[]> }) =>
  DASHBOARD_CARD_KEYS.filter((key) => result.lists[key].length);

describe("today's plan-specific activity counts", () => {
  it("keeps every list length equal to its count", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership()],
      payments: [payment()],
      trials: [trial(), trial({ id: "t2", member_id: "m1", duration_days: 1 })],
      attendance: [attendance()],
      members: [member(), member("g1", { is_guest: true })],
    }));
    for (const key of DASHBOARD_CARD_KEYS) {
      expect(result.lists[key].length).toBe(result[key as keyof typeof result] as number);
    }
    expect(countsOf(result as never).length).toBeGreaterThan(0);
  });

  it("counts new Gold Card and White Card sales today by plan family", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [
        membership("s1", { plan_id: "gold" }),
        membership("s2", { plan_id: "white" }),
      ],
    }));
    expect(result.newGoldCardToday).toBe(1);
    expect(result.newWhiteCardToday).toBe(1);
  });

  it("excludes renewals, switches, guests, cancelled and future purchases from new cards", () => {
    const result = calculateDashboardMetrics(input({
      members: [member(), member("g1", { is_guest: true })],
      memberships: [
        membership("s1", { renewed_from: "old" }),
        membership("s2", { status: "cancelled" }),
        membership("s3", { member_id: "g1" }),
        membership("s4", { start_date: "2026-10-03" }),
      ],
    }));
    expect(result.newGoldCardToday).toBe(0);
    expect(result.newWhiteCardToday).toBe(0);
  });

  it("classifies Gold Card (30/30) and White Card (15-serving) plan families", () => {
    expect(isGoldCardPlan(gold)).toBe(true);
    expect(isGoldCardPlan({ ...gold, duration_days: 15 })).toBe(false);
    expect(isGoldCardPlan({ ...gold, plan_type: "trial" })).toBe(false);
    expect(isWhiteCardPlan(white)).toBe(true);
    expect(isWhiteCardPlan({ ...white, duration_days: 30 })).toBe(true);
    expect(isWhiteCardPlan(gold)).toBe(false);
    expect(isPaid3DayTrialPlan(paid3)).toBe(true);
    expect(isPaid3DayTrialPlan({ ...paid3, price: 0 })).toBe(false);
  });

  it("groups renewal payments by plan family, counting people once and summing splits", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [
        membership("s1", { plan_id: "gold" }),
        membership("s2", { member_id: "m1", plan_id: "white", start_date: "2026-09-01" }),
        membership("s3", { member_id: "m1", plan_id: "paid3", start_date: "2026-09-01" }),
      ],
      payments: [payment(), payment({ amount: 1000 }), payment({ membership_id: "s2", amount: 3750 }), payment({ membership_id: "s3", amount: 750 })],
    }));
    expect(result.goldCardRenewalsToday).toBe(1);
    expect(result.whiteCardRenewalsToday).toBe(1);
    expect(result.renewals3DayToday).toBe(1);
    expect(result.lists.goldCardRenewalsToday[0].amount).toBe(8500);
  });

  it("ignores activations, unpaid rows, backdated renewals and unknown plans", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership("s1", { start_date: "2026-09-01" })],
      payments: [
        payment({ context: "activation" }), payment({ amount: 0 }), payment({ amount: -1 }),
        payment({ paid_at: "2026-10-01T18:29:59Z" }),
      ],
    }));
    expect(result.goldCardRenewalsToday).toBe(0);
    expect(result.whiteCardRenewalsToday).toBe(0);
    expect(result.renewals3DayToday).toBe(0);
  });

  it("includes queued renewals purchased today", () => {
    const result = calculateDashboardMetrics(input({
      memberships: [membership("s1", { status: "queued", renewed_from: "old", start_date: "2026-11-01" })],
      payments: [payment()],
    }));
    expect(result.goldCardRenewalsToday).toBe(1);
  });

  it("separates paid, free three-day, and one-day free trials started today", () => {
    const result = calculateDashboardMetrics(input({
      members: [member(), member("m2"), member("m3"), member("m4")],
      trials: [
        trial({ plan_id: "paid3" }),
        trial({ member_id: "m2" }),
        trial({ member_id: "m3", duration_days: 1 }),
        trial({ member_id: "m4", duration_days: 1, plan_id: "daily" }),
      ],
    }));
    expect(result.paidTrials3DayToday).toBe(1);
    expect(result.freeTrials3DayToday).toBe(1);
    expect(result.freeTrials1DayToday).toBe(1);
  });

  it("only counts trials started today — day 2 and 3 do not repeat in trial cards", () => {
    const result = calculateDashboardMetrics(input({ trials: [
      trial({ start_date: yesterday }),
      trial({ id: "t2", status: "converted" }),
      trial({ id: "t3", plan_id: "missing" }),
      trial({ id: "t4", end_date: null }),
    ] }));
    expect(result.paidTrials3DayToday).toBe(0);
    expect(result.freeTrials3DayToday).toBe(0);
    expect(result.freeTrials1DayToday).toBe(0);
  });

  it("counts guest day-2 visits only for free three-day trials started yesterday with attendance today", () => {
    const result = calculateDashboardMetrics(input({
      members: [member(), member("m2")],
      trials: [
        trial({ start_date: yesterday, end_date: "2026-10-03" }),
        trial({ id: "t2", member_id: "m2", plan_id: "paid3", start_date: yesterday, end_date: "2026-10-03" }),
      ],
      attendance: [
        attendance({ trial_id: "t1" }),
        attendance({ trial_id: "t2" }),
        attendance({ trial_id: "t1", visit_date: today }),
      ],
    }));
    expect(result.guestDay2VisitsToday).toBe(1);
  });

  it("rejects day-2 attendance for trials started today, cancelled trials, or other dates", () => {
    const result = calculateDashboardMetrics(input({
      trials: [
        trial({ start_date: today }),
        trial({ id: "t2", start_date: yesterday, status: "cancelled" }),
        trial({ id: "t3", start_date: yesterday }),
      ],
      attendance: [
        attendance({ trial_id: "t1" }),
        attendance({ trial_id: "t2" }),
        attendance({ trial_id: "t3", visit_date: "2026-10-03" }),
      ],
    }));
    expect(result.guestDay2VisitsToday).toBe(0);
  });

  it("counts new guests joining today and respects the physical/virtual filter", () => {
    const result = calculateDashboardMetrics(input({
      mode: "virtual",
      members: [member(), member("g1", { is_guest: true, member_mode: "virtual" })],
      memberships: [membership()],
      payments: [payment()],
      trials: [trial()],
    }));
    expect(result.newGoldCardToday).toBe(0);
    expect(result.goldCardRenewalsToday).toBe(0);
    expect(result.paidTrials3DayToday).toBe(0);
    expect(result.newGuestsToday).toBe(1);
  });

  it("uses exact IST midnight boundaries for payment dates", () => {
    expect(paymentDateIst("2026-10-01T18:29:59.999Z")).toBe("2026-10-01");
    expect(paymentDateIst("2026-10-01T18:30:00.000Z")).toBe(today);
    expect(paymentDateIst("2026-10-02T18:29:59.999Z")).toBe(today);
    expect(paymentDateIst("2026-10-02T18:30:00.000Z")).toBe("2026-10-03");
  });

  it("returns zero counts for empty data", () => {
    const result = calculateDashboardMetrics(input({ members: [] }));
    const { lists, ...counts } = result;
    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
    expect(Object.values(lists).every((l) => l.length === 0)).toBe(true);
  });
});
