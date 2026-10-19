# Fix: renewal payment shown as "NEW Gold Card" in Transactions

## Reason (confirmed from data)
- Kailash Kumawat's active plan is **RENEWAL -7500-GOLD CARD UMS**, and both ₹7,500 UPI payments (19 Oct) are marked as renewal payments.
- But each payment line also stores its own plan, and both were saved with **NEW Gold Card UMS-7500**.
- Transactions shows the plan saved on the payment line, so it says "NEW", while the Plan tab shows the membership's plan, which says "RENEWAL". That's why the two screens don't match.

## Fix
1. **Find where it goes wrong:** trace the renew and record-payment steps (desk renewal, online renewal, editing a membership) to find where the payment gets the old or NEW plan instead of the renewal plan.
2. **Permanent fix:** each payment line saves the membership's plan at the moment it's paid, so renewals always show the renewal plan.
3. **Display rule:** Transactions, sales details and Revenue show the payment's saved plan. A payment marked "renewal" will never show a "NEW" plan name. If the two disagree, the membership's renewal plan is shown.
4. **Correct past data:** find every renewal payment saved with a NEW-type plan (Kailash included) and point it to the membership's plan. Amounts and dates stay the same.
5. **Check:** add a test that a renewal payment shows the renewal plan, then confirm Kailash's Transactions row reads "RENEWAL -7500-GOLD CARD UMS".

## Technical details
- Data: `wellness_payments.plan_id` = NEW plan (e29feb1c…) while `wellness_memberships.plan_id` = RENEWAL plan and `context = 'renewal'`.
- Check the `record_payment`, `renew_membership_v2`, `admin_update_membership` and Razorpay fulfilment code; fix how `plan_id` is set. The fallback lives in `src/lib/salesLedger.ts`.
- Backfill update scoped to `context='renewal'` rows whose plan doesn't match the membership's plan.
