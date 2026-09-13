# Wellness Updates V2 — 7 features + 3 fixes

Implemented in four phases, all in one go.

## Phase 1 — Quick fixes

- **Joining date editable.** Add a joining-date field (defaults to today, IST) when adding a member, make it editable from the member profile for admins/managers, and add it to the CSV export.
- **Muscle mass ranges corrected.** Today the male thresholds (20/25) sit below the female ones (30/35), which is backwards. Corrected to male 30 / 37 / 45 kg and female 20 / 27 / 35 kg, with a Low band added. (The screen labels this reading in kg — say the word if your machine reports a percentage and I'll switch to percentage bands.)
- **Install button on the login page.** Show the existing "Install app" prompt with a short hint under the login form.
- **Weight milestones can now be lost again.** If someone regains weight and drops below a milestone, that milestone is removed automatically; the profile, badges and public milestone board all follow the database instead of keeping it permanently.

## Phase 2 — Member app

- **Weight progress chart** under the Start / Now / Target row: each reading is a dot, green when it moved towards the member's goal and red when it moved away, with "latest change" and "total change" below.
- **Record today's weight** button in the member app — enter the number, today's date is filled in automatically, and it replaces any earlier reading for the day.

## Phase 3 — Money and renewals

- **Payment mode and payment date** recorded on every membership and renewal (Cash, UPI, Card, Online, Other; date defaults to today so past payments can be backdated). Existing records are set to Cash with their start date.
- **Early renewal bonus.** Renewing on or before the plan's end date adds +2 free servings automatically, shown as a green note in the renewal screen before confirming, logged on the serving ledger, and followed by a congratulations WhatsApp message.

## Phase 4 — Events, rewards and reports

New **Reports** section in the sidebar with five tabs:

- **Family Day** — schedule the month's Sunday, list members with 26+ attendance days, list current milestone holders grouped by milestone, recalculate on demand, browse past months.
- **Lifestyle Day** — schedule and view the month's date.
- **MIW Challenge** — create a 21-day challenge, add participants, track start vs current weight, final ranking and export.
- **WLP King & Queen** — add WLP sessions for a month, tick off which coaches attended, highlight those at 4+ sessions as King (male) or Queen (female).
- **Revenue** — Daily / Weekly / Monthly / custom range, totals and transaction counts split by payment mode, a transaction table (date, member, plan, amount, mode) and Excel/CSV download.

Members see a **Family Day card** in their app: the date, whether they qualify on attendance and milestones, coach WLP session count, and a reminder that awards are handed out at the ceremony only.

## Technical notes

- Migration: `payment_mode` + `payment_date` on `wellness_memberships` (backfilled); new tables `wellness_events`, `wellness_event_participants`, `wellness_wlp_attendance`, `wellness_monthly_rewards` with grants and staff/member RLS; `calc_monthly_rewards(p_month)` RPC; `renew_membership_v2` extended with early-renewal bonus + ledger entry + notification queue row; `recalc_member_achievements` gains DELETE steps for weight milestones and for stale opposite-goal milestones.
- The brief's SQL is adapted to the real schema: member statuses are `active_member` / `renewal_due` (not `expiring_soon`), notification templates use `trigger_key` / `template_name` / `message_template`, and the notification log uses `trigger_key` + `channel` + `status`. `serving_transactions` requires an enum `txn_type`, so the bonus is logged as `manual_adjustment` with an "early renewal bonus" note.
- Frontend: new `src/hooks/useEvents.ts` and `useReports.ts`, `src/pages/WellnessReports.tsx`, `src/components/wellness/ScheduleEventDialog.tsx`; edits to `CreateMemberDialog`, `MemberDetailSheet`, `WellnessMembers`, `RenewPlanDialog`, `PortalHome`, `useAchievements`, `bodyEvalConstants`, `AppSidebar`, `App.tsx`, `Auth.tsx`, and regenerated Supabase types.
- Export is CSV/Excel-compatible (no PDF library added), matching the existing export pattern.
