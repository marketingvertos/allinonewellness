# Fix: guest trial attendance — today and yesterday not markable

## What the records show (Dr. Madhu Ratre)
- 1-day free trial, started 02 Oct, active, ends 03 Oct.
- Only one visit is recorded: **02 Oct** (counted as her trial serving). Nothing is recorded for today, 03 Oct.
- The system itself accepts a visit for today. It would be saved as an **extra visit**, to be deducted when she joins. So the block is in the screen, not the rules.

## Likely cause
The Mark attendance window works out "today" only once, when the Trials page first loads. If the page or phone app was left open from an earlier day, "today" stays stuck on that older date. The latest date you can pick is then yesterday (or earlier), and today can't be chosen at all. That explains both what you saw yesterday and what you see today.

## Fix
1. Work out today's date (India time) **every time the window opens**, and again on every tap of "Mark present". The date always defaults to the real today, and today is always selectable.
2. Add two quick buttons above the date box: **Today** and **Yesterday** (yesterday only if it's on or after the trial start). One tap picks the date, with no calendar fiddling. A date already marked shows "Already marked" and can't be chosen again.
3. Under the button, show the next visit's status clearly. For example: "Next visit today = extra visit (deducted when she joins)" or "Uses trial serving 1 of 3".
4. Mark Dr. Madhu Ratre present for **today (03 Oct)** as an extra visit, so it's deducted when she takes a membership.
5. Check on a phone-size screen: open Trials, mark today and yesterday for a test guest, and confirm the right toasts and labels appear.

## Rules stay the same
- Day one is marked automatically.
- A 1-day trial gives 1 trial serving. Any further visits are extra visits, deducted 1 for 1 from the first membership.
- Future dates and duplicate days are blocked.

## Technical details
- `TrialAttendance.tsx`: replace the fixed `today` value set once at load with a `todayIst()` call when the window opens and in `onClick`. Set `max` from that fresh value. Add Today and Yesterday chips, disabled when the date is in `dates` or before `startDate`.
- Data fix: insert the attendance row for 03 Oct through the same rules as staff marking (with `is_trial_advance = true`), recorded as a staff entry.
