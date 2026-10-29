# Fix Anubhav Jain's accidental 10-serving pack

## What the records show now
- 28 Oct: 10 servings packed by mistake (balance 12 → 2), with "S" marks on every day from 29 Oct to 7 Nov. These marks are why he can't check in, and why his profile says "Checked in today".
- 29 Oct, 8:05 am: an admin added a manual +10 to correct it (balance back to 12). The pack was never reversed, so the S marks stayed.
- His real club visits run up to 28 Oct. He has not actually checked in today.

## Fix (data only, no app changes)
1. **Reverse the pack**: mark the 28 Oct pack as reversed with the note "Issued by mistake, reversed by admin". Link the existing +10 entry to it as the reversal, so the 10 servings come back once only. Balance stays at 12; no second refund.
2. **Unlock the dates**: remove the 10 S marks for 29 Oct to 7 Nov so the days are free for check-ins.
3. **Mark today present**: add a club check-in for 29 Oct 2026 (front desk, 9:00 am IST) and deduct 1 serving with the normal daily entry. Balance becomes **11**, used servings **21 of 32**.
4. No WhatsApp message is sent for this correction.

## Result
- Servings history: Pack -10 (reversed), Reversal +10, Today's visit -1 → 11 left.
- Attendance: 29 Oct shows Present; 30 Oct onward is open for normal check-ins.

## Technical details
- `serving_transactions` 3aff90ae…: set reversed_at/reversed_by/reversal_note; 710a9726… (+10): set reverses_txn_id = 3aff90ae…, txn_type stays, note updated.
- Delete the 10 `wellness_attendance` rows where serving_txn_id = 3aff90ae….
- Insert `wellness_attendance` (visit_date 2026-10-29, method admin_manual) and a matching `daily_deduction` -1 txn (balance_after 11); update membership remaining 11 / used 21. Verify totals afterward.
