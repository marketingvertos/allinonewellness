# Guest trials: all plans in Convert, change trial plan, registration form for guests

## 1. Convert shows every active plan
Today the "Convert to plan" list only shows membership plans, so 3-Day Paid Trial and Daily Paid are missing.
- The list is grouped: **Memberships** (Gold Card UMS, White Card, renewals) and **Paid trials** (3-Day Paid Trial ₹750, Daily Paid ₹300). Inactive plans stay hidden.
- Picking a membership works as now.
- Picking a paid trial ends the guest trial as "converted" and starts a new paid trial on that plan from today, recording the payment (cash/UPI/card/online). Visits already used on the guest trial carry over and are not double-counted. Pink Card: the referrer gets 1 credit for a paid 3-day trial, as per the existing rule.

## 2. Change a guest's trial plan anytime
New **Change trial** button on every active or ended guest trial row (Trials page and the trial section of the profile).
- Options: 1-day free trial, 3-day free trial, 3-Day Paid Trial, Daily Paid.
- The end date and servings are recalculated from the original start date.
- Blocked if the guest has already used more visits than the new plan allows (for example, 2 visits used and you choose 1-day). The message explains why.
- Switching to a paid option records the payment. Switching paid to free asks you to confirm and notes it in history. The Pink Card credit is added or reversed automatically, so the referrer's balance stays correct.
- Every change is written to the member's notes (old plan → new plan, who changed it, and when).

## 3. Public registration form fills in an existing guest
Today the form refuses any number that is already registered.
- If the WhatsApp number belongs to a guest or lead who has **no active membership**, the form **updates that same profile** with whatever the guest fills in (email, gender, date of birth, marital status and anniversary, height, weight, target weight, goal, city or health notes). No duplicate is created.
  - Fields the guest leaves blank keep their old values. The name the guest types replaces the old name only if it is close to it. Otherwise the old name is kept and the typed name is saved in a note for staff.
- The guest's profile gets a "Form filled" tag, and staff get an alert like the current new-lead alert.
- Numbers that belong to members with an active membership still see "already registered".
- Staff then convert the guest from the Trials page as usual. The details from the form go straight into their membership.

## Technical details
- `WellnessTrials.tsx`: use active plans grouped by `plan_type`; the route depends on the type (membership → `convert_trial_to_membership`, trial → new RPC `convert_guest_to_paid_trial`).
- New security-definer RPCs (staff only) in one migration:
  - `convert_guest_to_paid_trial(p_trial_id, p_plan_id, p_mode)`
  - `change_trial_plan(p_trial_id, p_plan_id_or_null, p_duration_days)`: validates visits used, updates `plan_id/duration_days/end_date`, adjusts the Pink Card through the ledger (`award_pink_card`/reversal), and writes `member_notes`.
- Free trial options: `plan_id` null with duration 1 or 3, matching how `GuestTrialDialog` creates them today.
- New `ChangeTrialPlanDialog` component. The Change trial button sits on the row next to Convert.
- `public-register` edge function: when the mobile matches a member with no active or queued membership, it updates the provided fields only, adds a `form_filled` tag and a note, and sends the lead alert. Otherwise it keeps the current 409 response. Redeploy the function.
- Tests: the trial plan-change rules (visit limit, paid↔free Pink Card) in a new unit test for the pure validation helper.
