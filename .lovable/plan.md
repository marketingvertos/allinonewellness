# Guest trials, cleaner trial search, and renewal message at the scanner

## 1. Remove the duplicate "Check-in QR" menu item
The QR poster already lives inside Check-in > QR poster tab, so the separate sidebar entry is removed. The `/qr` route stays alive (redirects to the Check-in QR tab) so old links and printed posters keep working.

## 2. Trials page: start a trial for the right people
Add a "Start a trial" panel at the top of the Trials page:

- Search by name or mobile number.
- Results exclude anyone who already has an active, expiring-soon or queued membership, and anyone already on an active trial. Those rows show a short reason instead ("Already on a membership") rather than silently disappearing, so the front desk knows why.
- Selecting a person opens the existing start-trial dialog.

## 3. Guest trial (no membership registration)
If the person is not in the system, a "Start guest trial" button opens a small form:

- Name, mobile number, email (optional), start date (defaults to today).
- Fixed 3-day free trial.
- Creates a lightweight record flagged as a guest — it appears in Trials and can be checked in at the front desk, but it is not treated as a member anywhere else (member lists, KPIs, renewal alerts, achievements all filter guests out).
- Guest rows show a "Guest" badge and can be converted to a real membership from the same Convert control that existing trials use; converting clears the guest flag.

## 4. Scanner behaviour when the trial or plan is over
The check-in logic gets a clearer set of outcomes:

- Guest trial still running: visit recorded, no serving deducted.
- Guest trial finished: check-in is refused with "Your 3-day free trial has ended. Please take a membership — contact your coach."
- Member with no active membership, or an expired one: "Your membership has ended. Please renew — contact your coach."
- Member with 0 servings left: "No servings left on your plan. Please renew — contact your coach."

These messages appear both on the member's own QR screen and to the front desk when they scan/search, and no pending approval request is created in these cases (today a request is created and only fails at approval time).

## Technical notes
- Migration: add `is_guest boolean not null default false` to `wellness_members`; index on `(is_guest, status)`. No new table — guests reuse the member/trial tables so attendance, trials and conversion all work unchanged.
- Update `member_self_checkin` to validate trial/membership state before inserting into `wellness_checkin_requests`, returning `renew_required` / `trial_ended` statuses with the coach message. Mirror the same guards in `checkin_member` for staff entry.
- Filter `is_guest = false` in the member list, dashboard KPIs, upcoming renewals, achievements and global search queries.
- New hook `useStartGuestTrial` (insert member with `is_guest`, generate activation code, insert 3-day trial). New `GuestTrialDialog` and a trial-eligibility query on the Trials page.
- `PortalCheckIn` gains rendering for the new statuses; sidebar `mainNav` drops the QR item and `App.tsx` redirects `/qr` to `/checkin?tab=qr`.
