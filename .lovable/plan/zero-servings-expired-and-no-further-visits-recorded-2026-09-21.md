# Zero servings = expired, and no further visits recorded

## What changes

When a member's serving balance reaches 0, the plan is treated as finished straight away:

- The membership moves to **Expired**, and the member appears in the **Expired** list (not Active), even if the plan's end date is still in the future.
- If the member has another plan waiting in the queue, that one activates instead and the member stays active.
- Once at 0, **no visit can be recorded at all** — not by QR scan, not by the front desk, not by an admin entering it manually. Every route shows the same message: "No servings left on your plan. Please renew."
- A pending QR request from earlier in the day cannot be approved into a visit once the balance is 0 — approval is refused with the same message.
- Packing/issuing servings is also blocked at 0 (already the case).

## Dashboards refreshed

- Member profile, member app and admin dashboard show the live balance and an **Expired** state at 0.
- Check-in search rows show a red "No servings" badge and the Check in button is disabled for those members.
- Existing members already sitting at 0 servings are moved to Expired in one pass, so the lists and dashboard counts are correct immediately.

## Technical notes

Migration:
- `refresh_wellness_statuses()`: expire memberships where `remaining_servings <= 0` (in addition to past end date) before the member-status rollup, so members with no active/queued plan fall to `expired`.
- New trigger on `wellness_memberships` (AFTER UPDATE OF `remaining_servings`): when the balance hits 0 on an `active`/`expiring_soon` row, set that row to `expired`, call `activate_next_membership()` for a queued plan, then re-evaluate the member's status (`expired` when nothing active/queued remains).
- `checkin_member()`: keep the `remaining_servings <= 0` guard but stop it from being bypassed — after `activate_next_membership()`, re-check the balance and return `renew_required` for every method (`qr_scan`, `staff_entry`, `admin_manual`, `barcode_scan`).
- `approve_checkin_request()`: it delegates to `checkin_member()`, so a zero balance now returns `renew_required` and the request is marked rejected with that reason instead of creating attendance.

Data pass (after the migration): run `refresh_wellness_statuses()` once so current zero-balance memberships and members are corrected.

Frontend:
- `WellnessCheckIn.tsx`: disable the Check in button when the balance is 0 (badge already exists); keep "Save weight" available only for members already checked in.
- `MemberDetailSheet.tsx` plan tab: show "Expired — renew to continue" when balance is 0.
- No change to serving deduction logic, renewals, pink card, or payments.
