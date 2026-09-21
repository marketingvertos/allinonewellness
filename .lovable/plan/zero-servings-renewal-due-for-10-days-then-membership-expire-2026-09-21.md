# Zero servings = renewal due for 10 days, then Membership Expired

## What changes

Today, the moment a member's servings hit 0 they are pushed straight into the Expired list. That becomes a two-step flow:

1. **Servings reach 0** — the member moves to **Renewals due** and appears in the "Renewals due" card on the dashboard. A 10-day renewal window starts from that day.
2. **No renewal within 10 days** — on day 11 the membership and the member are marked **Membership Expired** and they move to the expired list.

If the member renews (or a queued plan activates) at any point in those 10 days, they go back to Active and the countdown is cleared.

Visits stay blocked the whole time: with 0 servings, no check-in can be recorded by QR scan, front desk or admin entry — the same "No servings left. Please renew." message. The 10-day window is only about which list the member sits in and the reminder they get from it.

## Wording

- Dashboard button "Expired members" becomes **Membership Expired** (count unchanged).
- The status tag shown on member rows, profiles and the expired list changes from "Expired" to **Membership Expired** everywhere it appears.
- The expired-members side panel title becomes "Membership Expired".

## Assumption

The 10-day window applies to memberships that run out of servings. Plans that reach their end date keep the current behaviour (expire on the date).

## Technical notes

Migration:
- Add nullable `servings_exhausted_on date` to `wellness_memberships`.
- Replace `trg_expire_on_zero_servings()`: when `remaining_servings <= 0` on an `active`/`expiring_soon` row, set `status = 'expiring_soon'` and stamp `servings_exhausted_on = today (IST)` instead of expiring; still call `activate_next_membership()` — if a queued plan activates, clear the stamp on the new row and leave the member active; otherwise set the member to `renewal_due`.
- Clear `servings_exhausted_on` whenever `remaining_servings` rises above 0 again (renewal/extension/manual correction), and re-set the member to `active_member` if they were `renewal_due` only because of this.
- `refresh_wellness_statuses()`: drop the blanket `remaining_servings <= 0` expiry; instead expire memberships where `servings_exhausted_on IS NOT NULL AND servings_exhausted_on < today - 10`, keeping the existing `end_date < today` rule. Member rollup (`renewal_due` when an `expiring_soon` plan exists, `expired` when nothing active/queued/expiring) then works unchanged.
- One-off data pass: for the 18 members currently sitting at `expired` with a zero-serving membership, restore the membership to `expiring_soon` with `servings_exhausted_on` set to the date their balance hit zero (from `serving_transactions`), set the member to `renewal_due`, then run `refresh_wellness_statuses()` so anyone already past 10 days falls back to expired correctly.

Frontend:
- `src/components/wellness/status.ts`: `expired` label → "Membership Expired".
- `WellnessDashboard.tsx`: button text → "Membership Expired".
- `ExpiredMembersSheet.tsx`: sheet title → "Membership Expired"; row badge uses `statusLabel`.
- Check-in guards, serving deduction, pink card, payments and renewals are untouched.
