# Ended trials: use leftover servings before extra visits

## The problem
Ashrita ghorpade's 3-day trial (29 Sept – 02 Oct) ended with 0 of 3 servings used, but her card shows "Mark extra visit". The screen treats an ended trial the same as a used-up trial, so leftover servings are ignored.

## The fix
Leftover trial servings stay usable even after the trial's end date. Extra visits begin only once all trial servings are used.

1. **Rule change (backend):** when staff mark a visit for a trial that still has unused servings, the visit uses a trial serving — even if the date is after the trial's end date. Only when all servings are used does a visit become an extra visit (deducted when they join).
2. **Trials page card:** the button shows "Mark attendance" while servings remain, and switches to "Mark extra visit" only when servings are used up. The hint line matches, e.g. "Next visit uses trial serving 2 of 3".
3. **Dialog wording:** for an ended trial with servings left, explain that the visit uses a leftover trial serving; no deduction on joining.
4. **Nothing else changes:** one visit per day, no future dates, no WhatsApp for trial visits, members on a plan can't get trial visits, extra visits still deduct 1-for-1 on joining.

## Example after the fix
Ashrita (3-day trial, ended 02 Oct, 0 of 3 used) visits today → card shows "Mark attendance", visit uses trial serving 1 of 3. After 3 visits, further visits become extra visits.

## Technical details
- Migration: update `mark_trial_attendance` — the `is_trial_advance` flag is set only when in-trial used count >= `duration_days`; the `end_date` check no longer forces extra visits (dates before `start_date` and future dates still refused; converted/cancelled trials still blocked; members with an active membership still blocked).
- `TrialAttendance.tsx`: `full` becomes `used >= total` only (drop the `endDate < today` condition); dialog description updated for ended trials with servings left.
- Existing extra visits already recorded (e.g. Dr. Madhu Ratre, whose 1-day trial had no servings left) are unaffected.
