# MIW: failed or cancelled online payment should not block registration

## What is happening
Pawan Tripathi started an online MIW payment in the member app today (14:53) and didn't finish it. That unfinished attempt is still marked "waiting". Staff registration refuses anyone with a waiting online payment, so you see "An online payment is pending; finish it before staff registration".

## What will change
1. **Staff can always register.** When staff click "Register & pay", the app first checks any unfinished online payment for that member and challenge directly with Razorpay:
   - **Not paid** (failed, cancelled or abandoned): the attempt is cancelled quietly and the cash/UPI/card registration goes through. No error shown.
   - **Actually paid**: the member is registered from that online payment, and staff see "Already paid online — registered". This stops anyone paying twice.
2. **Members can retry online.** A cancelled or failed payment keeps the "Try again" option. Retrying reuses the same attempt, or starts a new one if staff cancelled the old one. A payment failure (not just closing the window) now also says "Payment failed — nothing was charged. Try again."
3. **Pawan Tripathi's stuck attempt** clears the first time staff register him, so you can register him straight away.

## Technical details
- Database changes aren't landing right now, so this avoids them. A new staff-only `miw_clear_pending` action in the `member-access` backend function uses the shared Razorpay helper to fetch the order's payments. If one was captured, it calls the existing `miw_fulfil_payment`. If not, it sets that `razorpay_orders` row to `status='cancelled'`.
- `useRegisterMiwMember` calls this action first, then `miw_register_member`. If the member was fulfilled online, the cash registration is skipped.
- `razorpay-create-order` already only reuses `status='created'` orders, so a cancelled one leads to a fresh order on retry.
- `PayOnlineDialog` adds a `payment.failed` handler with a retry toast.
- Verify: test as admin by registering Pawan, then remove the test registration if he shouldn't stay in the challenge.
