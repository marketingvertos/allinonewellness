# Pink Card referral reward — tighten to UMS 30 (₹7,500) only

## Verified current state

- `trg_pink_card_membership()` currently awards +3 to the referrer whenever a new membership's plan has `duration_days >= 28` — it never checks `renewed_from`, so it runs on renewals and switches too (saved only by the dedup inside `award_pink_card`).
- Plans in the database: UMS 30 (₹7,500, 30 servings), Transform — 90 Servings (₹14,500, 90 servings), 15 Visit — White Card (₹3,750, 15 servings), plus trial/one-day plans.
- User decision: the +3 referral reward applies **strictly to the UMS 30 (₹7,500) plan** — Transform 90 and cheaper plans earn nothing.

## Change

One database migration replacing the `trg_pink_card_membership()` function:

1. Exit immediately when `NEW.renewed_from IS NOT NULL` — renewals (queue/replace) and plan switches never call `award_pink_card`.
2. Award +3 only when the plan is a membership plan priced at ₹7,500 (`plan_type = 'membership' AND price = 7500`), which today is exactly the UMS 30 plan.
3. Everything else stays identical: same call signature, `award_pink_card(NEW.member_id, 3, 'membership_referral', NEW.id)`, SECURITY DEFINER, `search_path = public`.

No frontend, types, or trigger changes — the trigger `pink_card_on_membership` stays as-is.

## Verified after fix

- Referrer earns +3 when a referred member's **first** membership is UMS 30 (direct purchase or trial conversion).
- Referrer earns nothing for Transform 90, White Card, Daily Paid, or any trial (trial +1 via `trg_pink_card_trial` is unchanged).
- Renewals and switches never reach the reward logic.
- Existing Pink Card ledger rows and balances are untouched — the fix only affects future awards.
