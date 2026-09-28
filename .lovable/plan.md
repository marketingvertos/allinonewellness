# Correct past Pink Card credits after referrer edits

## What was found

Referrer names edited before the automatic reversal existed left the credit with the wrong person. Six credits no longer match the member's current "Referred by":

| Credit holder (wrong) | For member | Credit | Current referrer |
|---|---|---|---|
| Mhattam Verma | Rajendra prasad verma | +1 trial | SHRI CHATAP |
| Mahendra kumawat | Mhattam Verma | +3 membership | Rajendra Kumawat |
| Hemant Kumawat | PUSHPA KUMAWAT | +3 membership | Teena Kumawat |
| Kulveer Singh Khalsa | Darshana Kaur Tuteja | +3 membership | Jaswant Kaur khalsa |
| SHRI CHATAP | Ashish yadav | +3 membership | Nikhil Sewkani |
| SHRI CHATAP | Pawan Tripathi | +3 membership | none (removed) |

## Fix

1. Take each wrong credit back: a "Referral reversed — [member]" line goes into the holder's Pink Card history, and their balance goes down. Mhattam Verma goes 1 → 0, Mahendra 3 → 0, Hemant 9 → 6, Kulveer 3 → 0, Shri Chatap 91 → 85.
2. Give the credit to the current referrer, but only when the member still qualifies under today's rules (+1 for a trial, +3 for a first UMS 30 at ₹7,500). Pawan Tripathi has no referrer now, so nobody gets that credit.
3. Check again afterwards: no credit is left with anyone who isn't the member's current referrer.

Changes from now on are already handled automatically.

## Technical notes

- One data script (run_sql), with no schema change. For each stale (holder, referred_member, reason) with net > 0, insert a `referral_reversal` row (note = original reason) and subtract from `pink_card_balance`. Then for each affected referred member, call `award_pink_card` using the same qualifying rules as `trg_pink_card_referrer_set` (first trial → +1; first non-renewal membership plan priced at 7500 → +3). The net-based dedup prevents double awards.
- Re-run the mismatch query to confirm it returns 0 rows, and list the final balances.
