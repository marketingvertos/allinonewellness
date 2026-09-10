# Coach Titles: Active Requirements & Title Maintenance

Ambassador → Crown titles stop being permanent trophies and become live status: a coach keeps a title
only while their own membership is active, their active frontline stays above the threshold, and they
add new memberships every month.

## Rules to enforce

1. **Only active frontline counts** — a referred member counts only if their status is Active member or
   Expiring soon. Leads, trials, expired and inactive people no longer count.
2. **Titles are reversible** — if the active count drops below a threshold, that title is removed.
   Weight-loss / weight-gain milestones stay permanent.
3. **Own membership required** — if the coach's own membership is not active, all coach titles are removed
   immediately and restored when they renew.
4. **Monthly quota** — up to Platinum: 1 new frontline membership per month; above Platinum: 2 per month.
   A missed month drops the coach one title level (not everything at once).

## Backend work

- New table `coach_monthly_activity` (coach, month `YYYY-MM` in IST, new memberships, required, met) with
  grants and read policies for staff and the coach themselves; only triggers write to it.
- Trigger on new memberships (`wellness_memberships` insert) increments the referrer's count for the
  current IST month and recalculates whether the quota is met.
- Rewrite `recalc_member_achievements`: own-membership check → active frontline count → previous-month
  quota check → remove titles below threshold → grant newly earned ones. Weight logic untouched
  (keeps the existing category-direction handling already in the function).
- **Safeguard not in the brief:** the recalc runs many times a day (every status change, weigh-in,
  check-in). Applying "drop one level" on every run would strip a coach's whole ladder within a day.
  A `last_downgrade_month` column records the month a penalty was already applied, so a missed month
  costs exactly one level, once.
- Coaches with no title yet are never penalised — the monthly quota only applies once a title is held.
- `monthly_coach_title_check()` sweeps all title holders; also reachable from the existing
  "Recalculate all members" admin action.
- Backfill: populate `coach_monthly_activity` from existing memberships, then recalc every member so
  current titles reflect the new rules (some existing titles will disappear — that is intended).

## App work

- **Achievements panel (profile + portal):** two counts — Active frontline and Total referred — with the
  title ladder driven by the active count. Adds a Monthly activity block (this month's progress, last
  few months with met/missed marks), a warning when the coach's own membership is inactive, and an
  at-risk marker on the current title when this month's quota is unmet. The people-helped list dims
  non-active members and shows their status.
- **Hook** `useCoachMonthlyActivity(memberId)` for the last 12 months.
- **Dashboard:** a "Coaches at risk this month" card — title holders who have not met the quota, with
  progress and days left in the month.
- **Achievements settings page:** wording updated to explain that coach titles are conditional and
  reversible, while weight milestones are permanent.

## Technical notes

- Month keys are computed with `now() AT TIME ZONE 'Asia/Kolkata'` everywhere.
- Deletions are scoped to `category = 'referral'`; weight categories are never deleted.
- New table follows the project pattern: create → grants → enable RLS → policies.
- `src/integrations/supabase/types.ts` regenerates after the migration; frontend work follows it.
- Verification: SQL checks on a real coach (title before/after a referred member expires), plus a
  browser pass over the profile Achievements tab, dashboard card and portal.
