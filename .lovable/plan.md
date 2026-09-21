# Correct Pawan's serving balance and renewal bonus rule

## Verified cause

Pawan Tripathi's serving history shows:

- Balance reached **0** after attendance on 21 September 2026.
- UMS renewal added **30 servings**.
- The valid early-renewal reward added **2 servings**, taking the balance to **32**.
- A successful ₹250 online purchase of the one-day **Daily Paid** plan added **1 serving**, taking it to **33**.
- The renewal function then incorrectly awarded another **2-serving early-renewal bonus** to that one-day purchase, producing the displayed balance of **35**.

The current bonus rule applies to every plan renewed before the existing end date. It does not exclude trial or one-day plans.

## Changes

1. **Correct Pawan's balance with an audit trail**
   - Reverse only the incorrect second two-serving bonus.
   - Set the live balance from 35 to the expected **33** and reduce the account's total allocated servings by two.
   - Record the reversal in serving history with a clear correction note and timestamp; preserve all existing payment and renewal records.

2. **Prevent recurrence**
   - Restrict the automatic +2 early-renewal bonus to regular membership plans only.
   - Trial and one-day plans such as **Daily Paid** will add their purchased servings but receive no early-renewal bonus.
   - Keep the existing bonus behavior for eligible membership renewals such as UMS.

3. **Align the renewal display**
   - Ensure the admin renewal screen only advertises the +2 bonus when the selected plan is actually eligible.

4. **Verify end to end**
   - Confirm Pawan shows **33 servings left** in both the member and admin views.
   - Confirm his history explains the 30 UMS servings, valid +2 bonus, one online serving, and the two-serving correction.
   - Test that a regular early membership renewal receives +2, while a one-day/trial online purchase does not.

## Technical details

- Apply the rule through a database migration so manual and online renewals share the same enforcement.
- Correct the existing row through an auditable serving adjustment rather than deleting history.
- Keep attendance deduction, Razorpay payment records, Pink Card logic, and WhatsApp behavior unchanged.
