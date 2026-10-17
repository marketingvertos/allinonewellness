# Fix: removed MIW participants keep showing

## What's wrong
- Clicking the bin icon shows "Participant removed", but nothing is actually deleted. The database blocks direct removal of MIW participants, and the app treats "0 rows removed" as success. SHRI CHATAP is still registered in "Nov-2026 -MIW Challange" with one ₹ payment attached.
- Deleting a member profile may also fail or leave MIW rows behind, because MIW participant and payment records were added after profile deletion was built.

## What will change
1. **Remove participant properly** — a secure staff-only action removes the person from the challenge, removes the MIW tag, and handles their MIW payment:
   - The payment record is kept for audit but marked as removed/refunded so it no longer counts in MIW collection or revenue.
2. **Honest feedback** — the app only says "Participant removed" when the removal really happened; otherwise it shows the reason.
3. **Confirmation** — the bin asks "Remove {name} from this challenge?" before acting.
4. **Profile deletion** — deleting a member also clears their MIW registrations, payments and pending online MIW orders, so they disappear from every MIW report.
5. **Clean up now** — after the fix, remove SHRI CHATAP from the Nov-2026 challenge (only if you confirm this is the intended removal).

## Technical details
- New security-definer RPC `miw_remove_participant(p_participant_id, p_reason)`: requires `is_wellness_staff`; sets `miw_payments.voided_at/void_reason` (new nullable columns), deletes participant (or soft-delete via `removed_at` if FK requires), strips `miw` from `wellness_members.tags`.
- `miw_report`, sales ledger MIW query, and club report totals exclude removed participants / voided payments.
- `useRemoveMiwParticipant` calls the RPC and invalidates report, challenges and sales queries.
- Update member deletion (member-access function / delete RPC) to delete `miw_payments`, `miw_participants` and MIW `razorpay_orders` for that member first.
- Test: removed participant's payment is excluded from MIW revenue.
