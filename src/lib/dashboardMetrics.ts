export interface DashboardMember {
  id: string;
  is_guest: boolean;
  member_mode: string;
  joining_date: string;
  full_name?: string;
  mobile_number?: string;
}

export interface ActivityListItem {
  memberId: string;
  planId: string | null;
  date: string;
  endDate?: string | null;
  amount?: number;
  label: string;
}

export interface DashboardPlan {
  id: string;
  name: string;
  plan_type: string;
  duration_days: number;
  total_servings: number;
  price: number;
}

export interface DashboardMembership {
  id: string;
  member_id: string;
  plan_id: string;
  start_date: string;
  created_at: string;
  renewed_from: string | null;
  status: string;
}

export interface DashboardTrial {
  id: string;
  member_id: string;
  plan_id: string | null;
  duration_days: number;
  start_date: string;
  end_date: string | null;
  status: string;
}

export interface DashboardPayment {
  member_id: string;
  membership_id: string;
  amount: number;
  context: string;
  paid_at: string;
  /** Plan actually paid for (online renewals can differ from the membership's plan). */
  plan_id?: string | null;
}

export interface DashboardAttendance {
  member_id: string;
  trial_id: string | null;
  visit_date: string;
}

export type DashboardCardKey =
  | "newGuestsToday"
  | "newGoldCardToday"
  | "goldCardRenewalsToday"
  | "newWhiteCardToday"
  | "whiteCardRenewalsToday"
  | "paidTrials3DayToday"
  | "freeTrials3DayToday"
  | "renewals3DayToday"
  | "freeTrials1DayToday"
  | "guestDay2VisitsToday";

export const DASHBOARD_CARD_KEYS: DashboardCardKey[] = [
  "newGuestsToday", "newGoldCardToday", "goldCardRenewalsToday", "newWhiteCardToday",
  "whiteCardRenewalsToday", "paidTrials3DayToday", "freeTrials3DayToday", "renewals3DayToday",
  "freeTrials1DayToday", "guestDay2VisitsToday",
];

export interface DashboardMetricInput {
  members: DashboardMember[];
  plans: DashboardPlan[];
  memberships: DashboardMembership[];
  trials: DashboardTrial[];
  payments: DashboardPayment[];
  attendance: DashboardAttendance[];
  today: string;
  /** Optional IST date range (inclusive); defaults to today only. */
  from?: string;
  to?: string;
  mode?: string;
}

/** Gold Card UMS family: 30-day membership plan with 30 servings. */
export function isGoldCardPlan(plan: DashboardPlan | undefined): boolean {
  return !!plan && plan.plan_type === "membership" && plan.duration_days === 30 && plan.total_servings === 30;
}

/** White Card family: any membership plan with 15 servings. */
export function isWhiteCardPlan(plan: DashboardPlan | undefined): boolean {
  return !!plan && plan.plan_type === "membership" && plan.total_servings === 15;
}

/** The paid three-day trial pack (plan_type trial, three days, priced above zero). */
export function isPaid3DayTrialPlan(plan: DashboardPlan | undefined): boolean {
  return !!plan && plan.plan_type === "trial" && plan.duration_days === 3 && Number(plan.price) > 0;
}

/** Date-only database values and payment timestamps are compared in India time. */
export function paymentDateIst(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function calculateDashboardMetrics(input: DashboardMetricInput) {
  const { today, mode = "all" } = input;
  const from = input.from ?? today;
  const to = input.to ?? today;
  const inRange = (d: string | null | undefined) => !!d && d >= from && d <= to;
  const dayBefore = (d: string) => new Date(Date.parse(d + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
  const members = new Map(input.members
    .filter((member) => mode === "all" || member.member_mode === mode)
    .map((member) => [member.id, member]));
  const plans = new Map(input.plans.map((plan) => [plan.id, plan]));
  const memberships = new Map(input.memberships.map((membership) => [membership.id, membership]));
  const trialsById = new Map(input.trials.map((trial) => [trial.id, trial]));

  const lists = Object.fromEntries(DASHBOARD_CARD_KEYS.map((key) => [key, []])) as Record<DashboardCardKey, ActivityListItem[]>;
  const seen = new Map(DASHBOARD_CARD_KEYS.map((key) => [key, new Set<string>()]));

  /** Each card counts people once; split payment lines sum into the first row's amount. */
  const addUnique = (key: DashboardCardKey, memberId: string, item: ActivityListItem) => {
    const bucket = seen.get(key)!;
    if (bucket.has(memberId)) return;
    bucket.add(memberId);
    lists[key].push(item);
  };
  const addRenewal = (key: DashboardCardKey, memberId: string, item: ActivityListItem) => {
    const bucket = seen.get(key)!;
    const existing = lists[key].find((row) => row.memberId === memberId);
    if (existing) {
      existing.amount = (existing.amount ?? 0) + Number(item.amount ?? 0);
      return;
    }
    bucket.add(memberId);
    lists[key].push(item);
  };

  // New pack sales today: memberships that are not renewals, starting today.
  for (const membership of input.memberships) {
    if (membership.renewed_from || membership.status === "cancelled") continue;
    const member = members.get(membership.member_id);
    if (!member || member.is_guest || !inRange(membership.start_date)) continue;
    const plan = plans.get(membership.plan_id);
    if (!plan) continue;
    const item = { memberId: member.id, planId: membership.plan_id, date: membership.start_date, label: "New" };
    if (isGoldCardPlan(plan)) addUnique("newGoldCardToday", member.id, item);
    else if (isWhiteCardPlan(plan)) addUnique("newWhiteCardToday", member.id, item);
  }

  // Renewals paid today, grouped by the membership's plan family.
  for (const payment of input.payments) {
    if (payment.context !== "renewal" || Number(payment.amount) <= 0 ||
        !inRange(paymentDateIst(payment.paid_at))) continue;
    const member = members.get(payment.member_id);
    const membership = memberships.get(payment.membership_id);
    if (!member || member.is_guest || !membership || membership.status === "cancelled" ||
        membership.member_id !== member.id) continue;
    const planId = payment.plan_id ?? membership.plan_id;
    const plan = plans.get(planId);
    if (!plan) continue;
    let key: DashboardCardKey | null = null;
    if (isGoldCardPlan(plan)) key = "goldCardRenewalsToday";
    else if (isWhiteCardPlan(plan)) key = "whiteCardRenewalsToday";
    else if (isPaid3DayTrialPlan(plan)) key = "renewals3DayToday";
    else continue;
    addRenewal(key, member.id, {
      memberId: member.id, planId, date: paymentDateIst(payment.paid_at),
      amount: Number(payment.amount), label: "Renewal",
    });
  }

  // Trials started today: three-day paid, three-day free, and one-day free.
  for (const trial of input.trials) {
    if (trial.status !== "active" || !inRange(trial.start_date) || !trial.end_date ||
        !members.has(trial.member_id)) continue;
    const plan = trial.plan_id ? plans.get(trial.plan_id) : undefined;
    // A missing referenced plan is unknown, rather than silently counted as free.
    if (trial.plan_id && !plan) continue;
    const paid = Number(plan?.price ?? 0) > 0;
    const base = { memberId: trial.member_id, planId: trial.plan_id, date: trial.start_date, endDate: trial.end_date };
    if (trial.duration_days === 3) {
      if (paid) addUnique("paidTrials3DayToday", trial.member_id, { ...base, label: "Paid trial" });
      else addUnique("freeTrials3DayToday", trial.member_id, { ...base, label: "Free trial" });
    } else if (trial.duration_days === 1 && !paid) {
      addUnique("freeTrials1DayToday", trial.member_id, { ...base, label: "One-day trial" });
    }
  }

  // Day-2 visits: free three-day trials that started yesterday, present today.
  for (const attendance of input.attendance) {
    if (!inRange(attendance.visit_date) || !attendance.trial_id) continue;
    const trial = trialsById.get(attendance.trial_id);
    if (!trial || trial.duration_days !== 3 || trial.start_date !== dayBefore(attendance.visit_date) || trial.status !== "active") continue;
    const plan = trial.plan_id ? plans.get(trial.plan_id) : undefined;
    if (trial.plan_id && (!plan || Number(plan.price) > 0)) continue;
    if (!members.has(trial.member_id)) continue;
    addUnique("guestDay2VisitsToday", trial.member_id, {
      memberId: trial.member_id, planId: trial.plan_id, date: attendance.visit_date, label: "Day 2 visit",
    });
  }

  for (const member of members.values()) {
    if (member.is_guest && inRange(member.joining_date)) {
      addUnique("newGuestsToday", member.id, { memberId: member.id, planId: null, date: member.joining_date, label: "Guest" });
    }
  }

  return {
    lists,
    newGuestsToday: seen.get("newGuestsToday")!.size,
    newGoldCardToday: seen.get("newGoldCardToday")!.size,
    goldCardRenewalsToday: seen.get("goldCardRenewalsToday")!.size,
    newWhiteCardToday: seen.get("newWhiteCardToday")!.size,
    whiteCardRenewalsToday: seen.get("whiteCardRenewalsToday")!.size,
    paidTrials3DayToday: seen.get("paidTrials3DayToday")!.size,
    freeTrials3DayToday: seen.get("freeTrials3DayToday")!.size,
    renewals3DayToday: seen.get("renewals3DayToday")!.size,
    freeTrials1DayToday: seen.get("freeTrials1DayToday")!.size,
    guestDay2VisitsToday: seen.get("guestDay2VisitsToday")!.size,
  };
}
