# Automatic Pink Card reversal when the referrer is changed

## What changes

When staff change or remove the "Referred by / Helped by" name on a member's profile, the Pink Card credit moves on its own:

- **Wrong name replaced with the right one:** the credit is taken back from the wrong member and given to the correct member.
- **Referrer removed:** the credit is taken back from the old referrer. Nobody gets it.
- **Referrer added for the first time:** no change from today — the credit is given as now.

Each move shows in the Pink Card history of both members:
- Old referrer: "Referral reversed — [member name]" with a minus amount and the date.
- New referrer: the usual "Trial referral" or "Membership referral" line.

## Rules

- Only the referral credits for that one member are moved (+1 for a trial, +3 for a first UMS 30 at ₹7,500). Manual adjustments and redemptions are never touched.
- The new referrer only gets credit the member actually qualifies for under today's rules. Right now, adding a referrer later uses an older rule (any plan of 28+ days); this is corrected to match the UMS 30 ₹7,500 rule.
- **If the old referrer has already used the credit**, their balance can go below zero (for example -3). This keeps the records honest, and the minus shows as money owed on their next renewal. Staff can still fix it with Adjust.
- No double credits: switching A → B → A gives the credit back to A only once.
- No WhatsApp messages are sent for reversals.
- Existing records are not changed — this applies to future edits only.

## Technical notes

- New ledger reason `referral_reversal` (text column, no enum change). `reasonLabel` in `PinkCardPanel.tsx` and any portal history label gain "Referral reversed — {name}".
- `award_pink_card` dedup changes from "any row exists for (referred_member_id, reason)" to "net credit for (referred_member_id, reason, referrer member_id) is not already positive", so a re-assignment after reversal can award again but never twice.
- Replace `trg_pink_card_referrer_set` to fire on any change of `referred_by_member_id` (including set to NULL):
  1. If `OLD.referred_by_member_id` is not null: for each reason (`trial_referral`, `membership_referral`), sum the old referrer's net ledger rows for this referred member; if > 0, subtract that from the old referrer's balance and insert a `referral_reversal` row (negative change, `referred_member_id` = this member, note naming the original reason).
  2. If `NEW.referred_by_member_id` is not null: award +1 for the first trial, and +3 only for the first non-renewal membership on a `plan_type='membership'` plan priced 7500 (same rule as `trg_pink_card_membership`).
- One migration: updated `award_pink_card` and `trg_pink_card_referrer_set`; trigger stays AFTER UPDATE OF `referred_by_member_id`. SECURITY DEFINER, `search_path = public`.
- Verify with a test member in SQL: set referrer A (credit), change to B (A reversed, B credited), clear (B reversed), set back to A (A credited once); then roll back.
