# Delete member profile (super admin only)

Give full admins a way to permanently remove a member profile, with a strong warning before it happens.

## What the admin sees

- On a member's profile, a red "Delete profile" button, visible only to full admin accounts (managers and staff do not see it).
- Clicking it opens a warning dialog that lists exactly what will be erased: check-ins, memberships, payments, weight and body records, Pink Card history, notes, WhatsApp history links, and the member's app login.
- The admin must type the member's full name to enable the red "Delete permanently" button. The action cannot be undone.
- After deletion the profile closes and the member list refreshes; a confirmation message names the deleted member.

## Rules

- Only accounts with the admin role can delete. Any other role gets a "not authorized" response even if they call the action directly.
- Deleting a member also removes their portal login so the mobile number can be registered again later.
- If the member referred others, those members stay; their "referred by" link is simply cleared, and referral counts are recalculated.
- Deletion is blocked with a clear message if it cannot complete cleanly, so nothing is half-removed.

## Technical notes

- Extend `supabase/functions/member-access/index.ts` with a `delete` action guarded by an `admin`-only role check (existing `isManager` check is not enough).
- The function, using the service role, in one sequence: delete `wellness_payments` rows for the member (that FK is RESTRICT, everything else cascades), null out `pink_card_ledger.referred_member_id` / `whatsapp_*` member links as needed, collect referred member ids, delete `wellness_members` row (cascades to memberships, attendance, servings, weights, measurements, notes, achievements, checkin requests, trials, razorpay orders, rewards, notification log), then `auth.admin.deleteUser` for the linked `user_id`, and call `recalc_network_counts` for the referrer and affected members.
- New hook `useDeleteMember` in `src/hooks/useWellness.ts` invoking the function and invalidating wellness member/dashboard queries.
- New `DeleteMemberDialog.tsx` in `src/components/wellness/` using the existing AlertDialog/Input pattern; wired into `MemberDetailSheet.tsx` next to "Edit profile", rendered only when the signed-in user has the `admin` role (add a `useIsWellnessAdmin` helper alongside `useIsWellnessManager`).
