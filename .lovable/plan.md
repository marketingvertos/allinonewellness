# Credit visits at zero servings (up to 3), settled on renewal

## What changes for staff and members
- **Member QR scan / self check-in:** stays blocked at 0 servings with the "Please renew" message (no change).
- **Admin / coach dashboard:** when a member at 0 servings is checked in, staff see a **"Mark credit visit"** option instead of a hard block. A confirm box shows "Credit visit 1 of 3 — will be deducted on renewal" and an optional note.
- Up to **3 credit visits** per member. On the 4th attempt staff see "Credit limit reached (3). Please renew first."
- Each credit visit counts as a normal **Present** day in attendance, reports and calendar, tagged "Credit" so it's visible.
- The member profile and dashboard show the balance as **-1 / -2 / -3** with a red "Owes N servings" badge; the low/zero-servings list includes them.
- **On renewal or new plan** (front desk, split payment, Razorpay, queued plan activation): the owed servings are deducted from the new plan automatically, e.g. UMS 30 + 2 bonus with 2 owed = 30 left. A history line reads "Credit visits settled (-2)". No double deduction.
- No WhatsApp message for credit visits.

## Technical details
- New migration:
  - `staff_credit_checkin(p_member_id, p_note)` — staff-only (`is_wellness_staff`), finds latest active/expiring/renewal-due membership, allows if `remaining_servings > -3`, inserts attendance (`admin_manual`, `serving_deducted=true`, note "Credit visit"), decrements remaining, writes `daily_deduction` ledger row with note. Duplicate-per-day guard same as `checkin_member`.
  - `checkin_member` and `member_self_checkin` unchanged (still block at ≤0); `checkin_member` returns `credit_available: true, owed: n` for staff callers so UI can offer the option.
  - `settle_credit_servings(p_member_id, p_new_membership_id)` — sums negative balances on the member's older memberships, resets them to 0 with a `manual_adjustment` row, and deducts the same amount from the new membership (`renewal_allocation`-linked adjustment note "Credit visits settled"). Idempotent via a marker in the transaction note/linked id.
  - Call it at the end of `create_membership`, `renew_membership_v2` (new/queued branches; in-place extend already nets out naturally), `activate_next_membership`, `fulfil_online_payment`.
  - Ensure membership status/expiry jobs don't mark negative-balance members expired before the existing 10-day grace.
- Frontend: `useWellness.ts` hook `useCreditCheckin`; staff check-in dialog / dashboard check-in and profile show the credit option on `renew_required`; balance display handles negatives; attendance row label "Credit".
- Add a test for the rule: max 3 credit visits and settlement math (owed deducted from new plan).
