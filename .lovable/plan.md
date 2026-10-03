# Guest trials: auto day-one attendance and extra visits deducted on joining

## What you'll get
1. **Day one marked automatically** — when you create a guest trial with today's start date (or an earlier date), that first visit is recorded straight away and uses trial serving 1. Future start dates are not marked.
2. **From day two, staff mark visits** on the Trials page as now (admin, manager, team, coach).
3. **Extra visits allowed** — once all trial servings are used (1 of 1, or 3 of 3), or the trial dates have passed, staff can still mark a visit. It is saved as an **extra visit** instead of being blocked. The card shows e.g. "Servings used 3 of 3 · 2 extra visits — will be deducted when they join".
4. **Ended trials stay visible** — guests whose trial ended in the last 30 days and who haven't joined yet appear in an "Trial ended — not joined yet" section, so you can keep marking visits and convert them.
5. **Automatic deduction on joining** — when that person takes any membership (from Trials "Convert", member profile, or online payment), every extra visit is taken off the new plan's servings, one per visit. Each shows in serving history as "Extra trial visit on DD/MM/YYYY", and the plan card shows the reduced balance.
   - Example: 3-day trial, came 5 days, joins UMS 30 (32 with bonus) → starts with 30 servings left.
6. Visits inside the trial's own servings are free and never deducted.

Unchanged: one visit per person per day, no future dates, no WhatsApp for trial visits, people already on a membership can't get trial visits.

## Technical details
- Migration:
  - `mark_trial_attendance`: allow trial status `active`/`expired`/`completed` (not `converted`/`cancelled`), allow dates from `start_date` to today; refuse if the member has an active/expiring/queued membership. If used-in-trial ≥ `duration_days` or date > `end_date`, insert with `is_trial_advance = true` (extra visit) and return `{status:'ok', extra:true, used, total, extra_count}`.
  - `trg_trial_advance_deduction`: reword the serving-history note to "Extra trial visit on …" (logic already deducts every undeducted `is_trial_advance` row on the first membership insert).
  - New `start_guest_trial_attendance` is not needed — the guest-trial hook calls `mark_trial_attendance(trial_id, start_date)` right after creating the trial when `start_date <= today`.
- `useStartGuestTrial`: return the new trial id (`.select('id').single()`), then call the RPC.
- `useActiveTrials` stays; add `useRecentEndedTrials()` (status expired/completed, end_date within 30 days, member with no active membership).
- `TrialAttendance.tsx`: split counts into in-trial vs extra (`is_trial_advance`), button never disabled for full trials (label "Mark extra visit"), dialog explains the serving will be deducted on joining; date `max` = today.
- `WellnessTrials.tsx`: render the ended-trials section with the same card controls and Convert.
