# Pink Card: +1 only for the paid 3-day trial

## New rule (from now on)
- **+1 credit** to the referrer only when the referred person starts the **3-Day Paid Trial (₹750)**.
- **Free trials** (1st Day Free, 3 Days Free, guest trials with no plan) and **Daily Paid (₹300)** give **no credit**.
- **+3 for a new member's first UMS 30 at ₹7,500** stays exactly as it is.
- Renewals, switches and other plans still give nothing.

## Where the rule applies
1. When a trial is started with a referrer already on the profile.
2. When a referrer is added or changed later (the automatic reversal / re-award) — the new referrer only gets +1 if the trial was the paid 3-day one. Reversals of old credits keep working as today.

## Past records
Not changed. Existing trial credits stay; staff can use Adjust if any should be removed (e.g. Mhattam Verma's +1 for Rajendra prasad verma's free trial — say the word and I'll reverse it).

## Technical details
- Today `trg_pink_card_trial()` awards +1 on every trial insert unconditionally.
- Migration: replace `trg_pink_card_trial()` to award only when the trial's plan is `plan_type = 'trial' AND price > 0 AND total_servings = 3` (currently only "3-Day Paid Trial"); trials without a plan get nothing.
- Update `trg_pink_card_referrer_set()` trial branch to pick the member's first trial matching the same condition.
- No frontend changes. Verify by querying function definitions after the migration.
