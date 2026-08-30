# Fix member check-in state and stacking renewals

## 1. Profile still says "Check in today" after approval

The member profile header always shows a live "Check in today" button, regardless of whether attendance already exists for today. It never reads today's attendance.

Change:
- The profile header reads today's attendance for that member.
- If already checked in: show a "Checked in today" badge with the visit time instead of the action button (no second punch possible).
- If not: keep the "Check in today" button as-is.

## 2. Renewal must add servings to the existing balance

The Plan tab's "Renew" button still calls the old renewal, which expires the current membership and drops leftover servings. The newer renewal dialog (with plan choice, servings and stacking modes) exists but was never wired into the member profile.

Change:
- "Renew" on the Plan tab opens the renewal dialog instead of renewing instantly.
- Default mode becomes **Add to the current plan** — pick the renewal plan, its servings prefill (e.g. 26), and the dialog shows the resulting balance in plain terms: `5 left + 26 new = 31 servings`, with the new end date.
- "Queue after current plan" and "Replace now" stay available as alternatives; Replace keeps its warning about servings being lost.
- Add a "Switch plan" action beside it using the existing plan-switch dialog.

## 3. End-to-end check

After the change, on a test member: renew with servings remaining, confirm the balance is the sum (not a reset), confirm the serving ledger records the added servings, confirm the profile shows "Checked in today" after an approved check-in. Test data removed afterwards.

## Technical notes

- `MemberDetailSheet.tsx`: use the existing today-attendance data (member attendance list already loaded — filter by IST today) for the header state; replace `useRenewMembership` usage with `RenewPlanDialog` + `SwitchPlanDialog`.
- `RenewPlanDialog.tsx`: default `mode` to `extend`, add a live balance summary line.
- No database changes — `renew_membership_v2` with mode `extend` already adds servings and days onto the running membership.
