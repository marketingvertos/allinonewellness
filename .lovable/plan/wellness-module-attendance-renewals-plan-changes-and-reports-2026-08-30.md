# Wellness module: attendance, renewals, plan changes and reports

A single pass covering the member list, renewals/plan switching, trials, the check-in hub with reports, and member categories.

## 1. Members list and profile

- Each row shows a **Checked in today** badge when attendance exists for today; rows without it get a quick **Check in** action (same approval-free staff check-in used on the check-in page, with the optional weight box).
- New **Edit member** dialog on the profile sheet: name, mobile, email, gender, date of birth, height, goal weight, batch, referrer, category, status.
- Members list gains a **Category** filter (Weight loss / Weight gain / any custom category).

## 2. Renewals that stack instead of wiping servings

Today "Renew" expires the current membership and its leftover servings are lost. Replacing it with a **Renew plan** dialog on the member profile:

- Pick the renewal plan, see its servings and price.
- Adjust servings up or down before confirming (with a reason note recorded in the serving ledger).
- Choose how it applies:
  - **Queue after current plan** (default when servings remain) — the new plan is created in a `queued` state and activates automatically the moment the current balance reaches zero or the current plan expires. Leftover servings are used first.
  - **Add to current plan** — servings and days are added onto the running membership.
  - **Replace now** — current behaviour, kept for corrections, and it warns how many servings will be dropped.

Additional profile actions:

- **Switch plan** — move an active member onto a different plan mid-cycle, with a choice to carry the remaining servings across or keep them as a queued balance.
- **Adjust servings** — existing add/remove servings, surfaced in the same place.
- Plans page gains full edit of an existing serving package (name, duration, servings, price, type) — no more deactivate-and-recreate.

## 3. Trials

- Trials page gets a **Free trial / Paid trial / All** filter (derived from the trial plan's price).
- Trial members appear in the trial dashboard regardless of how the trial was started.

## 4. Upcoming renewals

Members with **7 or fewer servings left**, or whose plan ends within 7 days, are listed under **Upcoming renewals** on the dashboard and as a filter on the members list, with a one-tap route into the renewal dialog.

## 5. Single Check-in hub with reports

The separate **Check-in QR** nav item goes away. `/checkin` becomes one page with sub-tabs:

- **Check in** — search/scan a member, record weight, check in. Members already checked in are marked.
- **Pending approvals** — today's QR requests with submitted weight, previous weight and delta; approve or reject.
- **Today** — live list of everyone checked in today; tapping a row opens that member's profile.
- **Reports** — daily / weekly / monthly / custom date range showing: total check-ins, approvals vs rejections, servings deducted, and a per-member summary line with weight recorded that day and whether they gained or lost against their previous reading. Includes a **Milestone watch** block: members who unlocked a 5/10/15 kg milestone in the period and those within 1 kg of the next one. CSV export for any range.
- **QR poster** — the existing printable centre QR, moved here. `/qr` keeps redirecting so printed posters still work.

## 6. Categories

Every member belongs to a category — **Weight loss** or **Weight gain** to start — and admins can create more. Existing goals map across automatically (fat loss, weight management, healthy lifestyle, general wellness and body transformation become Weight loss; weight gain stays Weight gain). Milestone/achievement calculations follow the category instead of the old goal field.

## 7. End-to-end check

After the build: attendance punch, serving deduction, queued-plan activation, weight tracking write and achievement recalculation are verified together in the live app on a test member, then the test data is removed. Anything that can't be wired is reported back.

## Technical notes

- Migration:
  - `member_categories` table (name, slug, direction `loss`/`gain`, active) seeded with the two defaults; `wellness_members.category_id` nullable FK, backfilled from `goal`; grants + RLS (staff manage, members read own).
  - `membership_status` enum gains `queued`.
  - `renew_membership_v2(p_membership_id, p_plan_id, p_servings, p_price, p_mode text)` where mode is `queue` | `extend` | `replace`; writes the matching `serving_transactions` rows.
  - `switch_membership_plan(p_membership_id, p_new_plan_id, p_carry_servings boolean, p_price)`.
  - `checkin_member` updated: when the active membership hits zero remaining, promote the oldest `queued` membership to `active` (recomputing its start/end dates) and deduct from it.
  - `recalc_member_achievements` reads `category_id` direction, falling back to `goal`.
  - All new functions `SECURITY DEFINER`, staff-only checks, execute granted to `authenticated, service_role` only.
- Frontend: new `EditMemberDialog`, `RenewPlanDialog`, `SwitchPlanDialog`, `CheckInReports` components; `WellnessCheckIn` reworked into tabs absorbing `WellnessQr`; hooks added to `useWellness.ts` (`useRenewPlan`, `useSwitchPlan`, `useCheckInReport`, `useMemberCategories`, `useUpcomingRenewals`); sidebar loses the QR entry.
- No changes to the member portal check-in flow or the PWA setup.
