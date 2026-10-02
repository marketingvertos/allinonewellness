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
}

export interface DashboardMetricInput {
  members: DashboardMember[];
  plans: DashboardPlan[];
  memberships: DashboardMembership[];
  trials: DashboardTrial[];
  payments: DashboardPayment[];
  today: string;
  mode?: string;
}

/** Keep plan classification independent of discounts or consumed serving balances. */
export function isUmsPlan(plan: DashboardPlan | undefined): boolean {
  return !!plan && plan.plan_type === "membership" && plan.duration_days > 1 &&
    (plan.total_servings === 15 || plan.total_servings === 30);
}

export function isDailyPlan(plan: DashboardPlan | undefined): boolean {
  return !!plan && plan.duration_days === 1 && Number(plan.price) > 0;
}

/** Date-only database values and payment timestamps are compared in India time. */
export function paymentDateIst(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function calculateDashboardMetrics(input: DashboardMetricInput) {
  const { today, mode = "all" } = input;
  const monthStart = today.slice(0, 7) + "-01";
  const members = new Map(input.members
    .filter((member) => mode === "all" || member.member_mode === mode)
    .map((member) => [member.id, member]));
  const plans = new Map(input.plans.map((plan) => [plan.id, plan]));
  const memberships = new Map(input.memberships.map((membership) => [membership.id, membership]));
  const firstMemberships = new Map<string, DashboardMembership>();

  // Find the first purchase across all history before applying the date window.
  // A returning member, renewal, or plan switch must never become a new member.
  for (const membership of input.memberships) {
    const member = members.get(membership.member_id);
    const plan = plans.get(membership.plan_id);
    if (!member || member.is_guest || membership.status === "cancelled" ||
        !plan || (plan.plan_type !== "membership" && !isDailyPlan(plan))) continue;
    const previous = firstMemberships.get(member.id);
    if (!previous || membership.created_at < previous.created_at ||
        (membership.created_at === previous.created_at && membership.id < previous.id)) {
      firstMemberships.set(member.id, membership);
    }
  }

  const lists: Record<string, ActivityListItem[]> = {
    newMembersToday: [], newMembersThisMonth: [], newUms30ThisMonth: [], umsRenewalsToday: [],
    dailyRenewalsToday: [], paidTrials3Day: [], freeTrials3Day: [], newGuestsToday: [],
  };
  let newMembersToday = 0;
  let newMembersThisMonth = 0;
  let newUms30ThisMonth = 0;
  for (const membership of firstMemberships.values()) {
    if (membership.renewed_from) continue;
    const started = membership.start_date;
    const item = { memberId: membership.member_id, planId: membership.plan_id, date: started, label: "New" };
    if (started === today) { newMembersToday += 1; lists.newMembersToday.push(item); }
    if (started >= monthStart && started <= today) {
      newMembersThisMonth += 1;
      lists.newMembersThisMonth.push(item);
      const plan = plans.get(membership.plan_id);
      if (isUmsPlan(plan) && plan?.duration_days === 30 && plan.total_servings === 30) {
        newUms30ThisMonth += 1;
        lists.newUms30ThisMonth.push({ ...item, label: "New UMS 30" });
      }
    }
  }

  const umsRenewals = new Set<string>();
  const dailyRenewals = new Set<string>();
  for (const payment of input.payments) {
    if (payment.context !== "renewal" || Number(payment.amount) <= 0 ||
        paymentDateIst(payment.paid_at) !== today) continue;
    const member = members.get(payment.member_id);
    const membership = memberships.get(payment.membership_id);
    if (!member || member.is_guest || !membership || membership.status === "cancelled" ||
        membership.member_id !== member.id) continue;
    const plan = plans.get(membership.plan_id);
    // Count people, not split payment lines; extend/queue/replace all use renewal payments.
    const addRenewal = (set: Set<string>, key: string) => {
      const existing = lists[key].find((i) => i.memberId === member.id);
      if (existing) existing.amount = (existing.amount ?? 0) + Number(payment.amount);
      else lists[key].push({ memberId: member.id, planId: membership.plan_id, date: today, amount: Number(payment.amount), label: "Renewal" });
      set.add(member.id);
    };
    if (isUmsPlan(plan)) addRenewal(umsRenewals, "umsRenewalsToday");
    if (isDailyPlan(plan)) addRenewal(dailyRenewals, "dailyRenewalsToday");
  }

  const paidTrials = new Set<string>();
  const freeTrials = new Set<string>();
  for (const trial of input.trials) {
    if (!members.has(trial.member_id) || trial.duration_days !== 3 ||
        trial.status !== "active" || trial.start_date > today ||
        !trial.end_date || trial.end_date < today) continue;
    const plan = trial.plan_id ? plans.get(trial.plan_id) : undefined;
    // No-plan trials include the existing three-day free guest flow.
    // A missing referenced plan is unknown, rather than silently counted as free.
    if (trial.plan_id && !plan) continue;
    const paid = Number(plan?.price ?? 0) > 0;
    const set = paid ? paidTrials : freeTrials;
    if (!set.has(trial.member_id)) {
      lists[paid ? "paidTrials3Day" : "freeTrials3Day"].push({
        memberId: trial.member_id, planId: trial.plan_id, date: trial.start_date, endDate: trial.end_date,
        label: paid ? "Paid trial" : "Free trial",
      });
    }
    set.add(trial.member_id);
  }

  for (const member of members.values()) {
    if (member.is_guest && member.joining_date === today) {
      lists.newGuestsToday.push({ memberId: member.id, planId: null, date: member.joining_date, label: "Guest" });
    }
  }

  return {
    lists,
    newMembersToday,
    newMembersThisMonth,
    newUms30ThisMonth,
    umsRenewalsToday: umsRenewals.size,
    dailyRenewalsToday: dailyRenewals.size,
    paidTrials3Day: paidTrials.size,
    freeTrials3Day: freeTrials.size,
    newGuestsToday: [...members.values()].filter((member) =>
      member.is_guest && member.joining_date === today).length,
  };
}
