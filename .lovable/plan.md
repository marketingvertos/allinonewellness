# Date format, membership editing, and the missing pink card credits

## 1. One date format everywhere

The DD / MM / YYYY box used for date of birth becomes the standard everywhere a person-related date is typed: date of birth, anniversary and joining date — on Add member, Edit profile, the member profile quick edits, and the public registration form. Typing jumps from day to month to year, and the calendar with quick month/year picking stays available. Age keeps showing under the date of birth only.

Report ranges and other filters keep their current pickers.

## 2. Edit an activated membership

Admins and managers get an **Edit membership** option on the member's plan card. It opens a form to correct:

- Plan (switching recalculates the plan price and end date, with the option to keep the current servings)
- Start date and end date
- Payment method, payment date and amount collected
- Total and remaining servings, entered by hand, so uploaded or historical data can be corrected

Every serving correction is written to the member's serving history with a note, so balances stay explainable. Corrections never send WhatsApp messages.

## 3. Pink card — what went wrong and the fix

Checked the live records. Trappti Paraye was created at 12:06 PM, her membership was activated at 12:07 PM, and Shri Chatap was set as her referrer only at 12:16 PM — nine minutes after the plan was sold. Credits are granted at the moment the membership is sold, and at that moment she had no referrer recorded, so nothing was awarded. Shri's pink card balance is still 0 and there is no entry in the pink card history.

Fix:

- Award the credits when a referrer is added later as well: if the person already has a qualifying membership (28 days or more) or a trial, the referrer gets the credits straight away. The existing one-credit-per-person-per-reason guard stays, so no double awards.
- Award the credits when a membership's plan is corrected to a qualifying one.
- Correct today's case: give Shri Chatap the 3 credits he earned from Trappti's membership, recorded in the pink card history with today's date.
- On the member profile, show the referrer's name next to the pink card so this is easy to spot.

## Technical notes

- Replace `<Input type="date">` with `DobInput` for `date_of_birth`, `anniversary_date` and `joining_date` in `CreateMemberDialog.tsx`, `EditMemberDialog.tsx`, `MemberDetailSheet.tsx` (lines 249 / 448 area) and `PublicRegister.tsx`; `showAge` only on date of birth. Add an optional `minYear`/`maxDate` guard so joining dates default sensibly.
- New `EditMembershipDialog` in `src/components/wellness/`, opened from the plan card in `MemberDetailSheet.tsx`, gated by the existing staff/manager check. New security-definer RPC `admin_update_membership(p_membership_id, p_plan_id, p_start_date, p_end_date, p_total_servings, p_remaining_servings, p_price, p_payment_mode, p_payment_date)` that requires `is_wellness_manager`, updates the row, and logs any serving delta into `serving_transactions` as `manual_adjustment`. New hook `useUpdateMembership` invalidating member, membership and serving queries.
- Pink card: new trigger `pink_card_on_referrer_set` — AFTER UPDATE OF `referred_by_member_id` ON `wellness_members`, when the new value is non-null and different, calls `award_pink_card` for each existing qualifying membership (plan `duration_days >= 28`) and trial of that member. Also fire `trg_pink_card_membership` on UPDATE OF `plan_id` on `wellness_memberships`. `award_pink_card`'s existing dedup on (`referred_member_id`, `reason`) prevents duplicates.
- One-off data fix: run `award_pink_card('102a31f3-…', 3, 'membership_referral', '33304ac1-…')` so Shri Chatap's balance and ledger reflect the referral.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json` and a re-check of `pink_card_ledger`.
