# Refresh Pink Card balances under the new rules

## What I checked

I compared every Pink Card entry against the new rule (+3 only for a referred member's **first** UMS 30 (₹7,500) membership, never for renewals or other plans):

- **No wrong credits were given.** All 52 referral credits match the new rule.
- **Every member's balance matches their history.** No drift between the shown balance and the entries.
- **4 referrals were missed** — the referrer never got their 3 servings even though the referred member bought the UMS 30 plan:

| Referrer | Referred member |
|---|---|
| Shri Chatap | Bharat Kalwani |
| Vinay Bhatia | Nikhil Sewkani |
| Girish Arora | Pravar Shrivastava |
| Nikhil Sewkani | Divya Rajani |

Note: Girish Arora already has a +3 entry marked "Manual correction by admin" from earlier. If that was meant to cover Pravar Shrivastava, awarding again would double it.

## What I will do

1. Award the missing +3 credits to Shri Chatap, Vinay Bhatia and Nikhil Sewkani (3 entries), each recorded in Pink Card history with the referred member's name and a note "Backfill: referral reward under updated rules", dated today.
2. Leave Girish Arora out of the backfill, since his manual +3 appears to already cover it. Say the word and I will add it too.
3. Each member's Pink Card balance updates automatically with the entry, so the profile screens show the refreshed number straight away.

Nothing is removed and no existing entry is edited — only the missing rewards are added.

## Technical notes

- Backfill runs as a one-off data change on `pink_card_ledger` + `wellness_members.pink_card_balance`, using the existing `award_pink_card` path so `balance_after` stays correct.
- No schema change, no code change; the corrected `trg_pink_card_membership` already handles all future cases.
