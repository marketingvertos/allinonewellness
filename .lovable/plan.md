# Edit packed-serving dates

Let staff fix wrong serving dates, or add missing ones, so the member can check in on the day they actually come to the club.

## What staff will see

**Member profile > Servings tab**
- Each "Packed / issued" entry lists the dates it covers, e.g. "For: 10 Oct, 11 Oct, 12 Oct".
- A new **Edit dates** button on each packed entry opens a window with one date picker per serving, like the Issue Servings window.
- Any date can be moved forward or to a past date (back date). The same date can't be used twice.
- A date where the member already has a club visit shows "Already present". It can't be picked.
- If an older pack has no dates yet, staff can add them here.
- Saving shows: "Dates updated. 11 Oct is now free for check-in."

**Issue Servings window**
- Day 1 still starts tomorrow by default. Staff can now also pick past dates, for when the team forgot to record a serving on the right day.

## What happens after a date change
- The old date's "S" is removed from the Attendance register. The new date shows "S".
- If the old date was today or a future day, the member can now check in on that day the normal way (QR, front desk or self check-in).
- **The serving balance doesn't change.** The number of servings stays the same; only the dates move.
- No WhatsApp message goes out.
- The change is recorded in the member's notes ("Serving dates changed from 11 Oct to 9 Oct by Shri Chatap") and in the serving history.

## Who can do it
- Staff and admins. Members see the updated dates in their app history but can't edit them.

## Technical details
- Migration:
  - Add `serving_txn_id uuid` to `wellness_attendance` (nullable, FK to `serving_transactions`, index). Backfill it from existing `serving_transactions.attendance_id` links. For packs without links, match `serving_issue` rows by member, membership and the same `created_at` minute/`staff_id`.
  - Update `issue_servings` to set `serving_txn_id` on every attendance row it inserts.
  - New RPC `edit_serving_dates(p_txn_id uuid, p_dates date[])`, security definer, staff-only. It checks the transaction is `pack_and_issue`, that there are no more dates than its quantity and none repeated, and that no new date has a non-`serving_issue` attendance for the member. It deletes the old `serving_issue` rows for the transaction and inserts the new ones (`visit_time` 09:00 IST, `serving_deducted=true`). It doesn't touch balances, writes a `member_notes` entry and returns the new dates.
  - `queue_checkin_notification` already skips `serving_issue`, so no messages are sent.
- Frontend:
  - `useWellness.ts`: add `useServingTxnDates(txnId)` and `useEditServingDates`. The edit invalidates the ledger, attendance, dashboard and serving-report data.
  - New `EditServingDatesDialog.tsx`, reusing the date-picker rows from `IssueServingsDialog`.
  - `MemberDetailSheet.tsx` Servings tab: show the covered dates and an Edit dates button on `pack_and_issue` rows.
  - `PortalHistory.tsx`: show the covered dates.
- Verify: change a pack's date in the preview and confirm the Attendance register moves the "S" and check-in works on the freed date.
