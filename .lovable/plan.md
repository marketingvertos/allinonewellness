# Today's plan-specific activity cards (replaces the 8-card section)

## What you'll get

The "New members, renewals & trials" section is replaced by ten plan-specific cards, all scoped to **today (India time)**, all tappable, all honouring the Physical / Virtual filter:

| # | Card (new copy) | Counted |
| --- | --- | --- |
| 1 | **New guests today** — "First-time visitors who joined today" | Guest profiles with joining date = today |
| 2 | **New Gold Card UMS · ₹7,500** — "New 30-visit memberships started today" | First membership (renewed_from is null) on a 30-serving, 30-day membership plan, starting today |
| 3 | **Gold Card UMS renewals** — "30-visit ₹7,500 renewals paid today" | Renewal payment today linked to a 30-serving membership plan (people counted once, split payments summed) |
| 4 | **New White Card · 15 visits · ₹3,750** — "New memberships started today" | First membership on a 15-serving membership plan, starting today |
| 5 | **White Card renewals** — "15-visit ₹3,750 renewals paid today" | Renewal payment today linked to a 15-serving membership plan |
| 6 | **3-day paid trials · ₹750** — "Paid trial packs started today" | 3-day trials started today on the ₹750 trial plan |
| 7 | **3-day free trials** — "Free guest trials started today" | 3-day trials started today with no plan or a ₹0 plan |
| 8 | **3-day renewals · ₹750** — "Repeat 3-day packs paid today" | Renewal payment today where the membership's plan is the ₹750 3-day trial plan |
| 9 | **One-day free trials** — "Single-visit trials started today" | 1-day free trials (no plan / ₹0 plan) started today |
| 10 | **Guest day-2 visits** — "Day 2 of a trial that started yesterday" | Free 3-day trials started yesterday with attendance marked today |

Every card opens the same style of side panel as today: one row per person (name, mobile, Physical/Virtual badge, plan, relevant date and amount), a tag per row (New / Renewal / Paid trial / Free trial / Day 2 visit / Guest / One-day trial), tap to open the full profile, and a friendly empty message when the count is 0 (card stays tappable).

Section heading copy: **"Today's club activity"** with subtitle "Guests, memberships, renewals and trials — India time. Tap any card to see who it counts."

Removed: New members today, New members this month, New 30-day UMS, UMS renewals today, Daily renewals today, and the old 3-day paid/free trial cards (replaced by the plan-specific versions).

## Classification rules

- Plan families are matched by plan type and servings, not by price, so cards stay correct if prices change: Gold Card UMS = membership plan with 30 servings and 30 days; White Card = membership plan with 15 servings (either duration). Other membership plans (e.g. the 10-day plan) are not covered by these cards.
- New-member cards use the existing first-purchase rule: renewals, switches and returning members never count as new.
- Renewal cards are driven by payments with context "renewal", paid today; each member counts once per card, split payment lines are summed.
- Trial cards are scoped to trials **started today** (a trial on day 2 or 3 shows only in Guest day-2 visits and nowhere else as a new-trial count).
- Guest day-2 visits join today's trial attendance (`wellness_attendance.visit_date = today`, trial_id set) with trials whose start date is yesterday and plan is free.

## Technical details

- `src/lib/dashboardMetrics.ts`
  - Replace the metric set with the ten new keys: `newGuestsToday, newGoldCardToday, goldCardRenewalsToday, newWhiteCardToday, whiteCardRenewalsToday, paidTrials3DayToday, freeTrials3DayToday, renewals3DayToday, freeTrials1DayToday, guestDay2VisitsToday`.
  - Add plan-family helpers (`isGoldCardPlan`, `isWhiteCardPlan`, trial family helpers); replace `isUmsPlan`/`isDailyPlan` usage.
  - `DashboardMetricInput` gains `attendance: { member_id, trial_id, visit_date }[]` and trials now carry rows started yesterday too.
  - Each count still has a matching `lists[...]` entry built in the same loop, so a card number and its panel can never disagree.
- `src/hooks/useDashboardMetrics.ts`
  - Widen the trials query to start dates of yesterday and today (plan_id included).
  - Add a third query: today's attendance rows with a trial_id (for guest day-2 visits).
- `src/components/wellness/DashboardActivityCards.tsx`
  - New 10-card array with the improved copy and icons; grid stays responsive (4 per row on desktop).
- `src/components/wellness/ActivityMembersSheet.tsx`
  - Row labels/tags for the new card types (Day 2 visit, One-day trial); no structural change.
- `src/lib/dashboardMetrics.test.ts`
  - Rewrite for the new keys; keep a test that every list length equals its count, plus one focused test per new rule (plan-family splits, started-today scoping, day-2 requires attendance today, renewal payment per plan family, split-payment summing).

Frontend only — no database or backend changes.

## Verification

- Typecheck, production build and Vitest suite clean.
- Preview check: the section shows the ten cards with the new copy; tapping each opens the correctly filtered people panel; zero-count cards stay tappable with a friendly empty state.
