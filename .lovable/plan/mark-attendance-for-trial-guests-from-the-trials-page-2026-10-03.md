# Mark attendance for trial guests from the Trials page

## What you'll get
On the Trials page, every active trial card (guest or member, free or paid) gets:
- **Servings used: X of N** — N is the trial's serving count (1-day trial = 1, 3-day trial = 3). Each marked visit uses one serving.
- **Mark attendance** button — opens a small pop-up with a date (defaults to today; can pick any earlier day inside the trial period, never a future date). Confirm records the visit.
- A list of the days already marked under the card (e.g. "3 Oct, 4 Oct").

Rules:
- Only admin, manager and team members can mark it.
- One visit per person per day; a second attempt that day shows "Already marked for this day".
- Blocked once all trial servings are used ("All trial servings used — convert to a membership").
- Dates outside the trial's start–end dates are refused.
- Marked visits show in the Attendance register, attendance reports and dashboard counts like any other visit, tagged as staff entry.
- No WhatsApp check-in message is sent for trial visits (same as today).

## Technical details
- Migration: new security-definer RPC `mark_trial_attendance(p_trial_id uuid, p_date date default IST today)` — staff-only (`is_wellness_staff`), checks trial is active/not cancelled, date within `start_date..end_date` and not in the future, no existing `wellness_attendance` row for that member+date, and used visits (`count` of attendance with that `trial_id`) < `duration_days`. Inserts `wellness_attendance` (`trial_id`, `visit_date = p_date`, `visit_time` = date at current IST time, `checkin_method = 'staff_entry'`, `serving_deducted = false`, `staff_id = auth.uid()`). Returns `{status, used, total}`. GRANT to authenticated.
- Hook `useMarkTrialAttendance` + `useTrialAttendance(trialIds)` (reads attendance rows by trial_id) in `useWellness.ts`; invalidate trials, attendance, dashboard metrics queries.
- New `MarkTrialAttendanceDialog.tsx`; `WellnessTrials.tsx` card shows usage, marked days and the button (disabled when used = total).
