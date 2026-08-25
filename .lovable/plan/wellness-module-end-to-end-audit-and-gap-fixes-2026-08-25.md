# Wellness module: end-to-end audit and gap fixes

I checked every wellness page, hook, table and database function against the original PRD plan and the later feature briefs. The core lifecycle (members → trial → membership → check-in → servings → progress → achievements → member portal) is built and typechecks clean. Below is what is genuinely missing or half-finished, and how I will close it.

## Confirmed gaps (verified against code and live data)

1. **Batches are dead weight.** `wellness_batches` holds 2 rows and `wellness_members.batch_id` exists, but there is no page, no hook and no way to assign a member to a batch or coach.
2. **Notification templates and log are invisible.** 3 templates and 8 queued log rows exist in the database; nothing in the app shows or acts on them, so low-balance and expiry alerts never reach anyone.
3. **Trials are under-served.** Only a hard-coded "Start 3-day trial" button on the member sheet. No trial plan choice or duration, no trials list, no trials-ending-today view.
4. **Dashboard is missing PRD cards.** Present: total members, check-ins today, active memberships, renewals due, revenue, low balance, birthdays. Missing: active trials, trials ending today, trial→member conversion rate, serving-consumption trend chart.
5. **Renewals due is a number with no list.** Staff can see the count but cannot open who is due.
6. **Referrals are invisible outside a single profile.** No "people helped" column on the members list and no ambassador leaderboard, even though titles now exist.
7. **Member search misses identifiers.** Members list and the referrer picker search name and mobile only — not membership code or activation code.
8. **No wellness data export.** Sales has CSV import/export; wellness has none.
9. **Body measurements never used.** The recorder exists on the profile but 0 rows exist — I will surface it in the check-in flow too so waist/hip get captured during visits.
10. **Auth hardening.** Leaked-password protection is still off in the backend auth settings.

## What I will build

**Batches**
- `/wellness/batches` page: create/edit/archive batches (name, program type, coach, start/end, capacity, status), with live member counts and capacity warnings.
- Batch picker on the add-member dialog and on the member profile.

**Notifications**
- `/wellness/notifications` page with two tabs: Templates (CRUD on trigger key, channel, message with `{{name}}`-style placeholders, active toggle) and Log (queued/sent/failed, filter by status).
- Each queued row gets a one-tap "Send on WhatsApp" action that opens `wa.me` with the rendered message and marks the row sent — no external vendor needed. Structure stays ready for an automated sender later.

**Trials**
- Trial dialog on the member profile: pick a trial plan, set duration and start date, capture starting weight.
- `/wellness/trials` page listing active trials with days remaining, ending-today highlighting, and a direct convert-to-membership action.

**Dashboard**
- Add active trials, trials ending today and conversion-rate cards.
- Add a 30-day serving-consumption trend chart (from the serving ledger) next to the existing revenue card.
- Make "Renewals due" and "Low balance" clickable into a filtered members view.

**Members and referrals**
- Members list: add a "Helped" count column plus filters, and extend search to membership code and activation code (same for the referrer picker).
- Ambassador leaderboard card on the Achievements page: top referrers with title and count.

**Data and hygiene**
- CSV export of members (with status, plan, servings, weights, referrer) from the members page.
- Add the measurement capture step to the staff check-in flow.
- Turn on leaked-password protection in auth settings.

## Technical notes

- New hooks in `useWellness.ts`: `useBatches`, `useSaveBatch`, `useNotificationTemplates`, `useSaveNotificationTemplate`, `useNotificationLog`, `useMarkNotificationSent`, `useActiveTrials`, `useServingTrend`, `useTopReferrers`.
- New pages: `WellnessBatches.tsx`, `WellnessTrials.tsx`, `WellnessNotifications.tsx`, plus routes in `App.tsx` and sidebar entries.
- New components: `BatchPicker.tsx`, `StartTrialDialog.tsx`, `ServingTrendChart.tsx` (recharts, matching `MemberDashboard` styling).
- One migration only if needed: a small `mark_notification_sent(p_id uuid)` function and an update policy on `wellness_notification_log` (today it is insert/update denied), plus indexes on `wellness_members.batch_id` and `referred_by_member_id`. No table changes.
- Everything reuses the existing patterns: `PageBanner`, IST formatters, `formatCurrency`, `sanitizeErrorMessage`, semantic tokens, manager-only writes via `is_wellness_manager`.
