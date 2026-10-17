# Fix: MIW participant removal still failing

## What is happening
The bin button now shows the real error ("Could not find the function miw_remove_participant"). The database update that adds this removal action was saved twice in the project but never actually ran on the live database: the removal function and the new "removed" / "voided" fields are still missing. SHRI CHATAP is still registered in "Nov-2026 -MIW Challange" with one ₹500 payment.

## Plan
1. **Re-apply the database update as a fresh, single step** (new name, same content as the saved one): add the removed/voided fields, create the staff-only removal action, and update the MIW report to hide removed people and voided payments. Immediately confirm it is live by checking the function and fields actually exist.
2. **Fallback if it still doesn't land:** move the removal into a backend function (same pattern as the existing member-access function) that checks the user is staff, then removes the participant's registration and their MIW payment rows, strips the MIW tag if they have no other active challenge, and writes an audit note on the member profile (who removed, when, reason, amount). The bin button calls this instead. This doesn't depend on the database update landing.
3. **Remove SHRI CHATAP** from the Nov-2026 challenge using the working path, and confirm Participants shows 0 and Revenue shows ₹0.
4. **Revenue sync:** re-enable excluding voided MIW payments from revenue totals (only if step 1 succeeded; with the fallback the payment rows are gone, so revenue drops automatically).
5. **Verify in the preview** as admin: open Events > MIW Challenge, remove a participant, see the success message, the person disappears from the list and counts update; a non-staff member cannot remove anyone.

## Technical details
- Step 1: new migration re-running `drizzle/migrations/0066` SQL plus the `miw_report` rewrite from `0065`; verify via `pg_proc` and `information_schema.columns`.
- Step 2: action `miw_remove_participant` in `supabase/functions/member-access` using service role; `useRemoveMiwParticipant` in `src/hooks/useWellness.ts` invokes it; remove the `as never` RPC call.
- Error toasts stay honest (no fake success when nothing was removed).
