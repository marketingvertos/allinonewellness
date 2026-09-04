# Member accounts created automatically by the team

Members no longer activate their own account. The front desk creates the member, and the portal login is created for them in the same step with a standard default password.

## What changes for the user

Login page (`/auth`, Member side):
- The "Sign in" / "Activate account" switch and the activation-code field are removed. The member side is simply mobile number + password.
- The failed-sign-in message drops the "or activate your account first" wording and instead says to contact the centre front desk.

Adding a member:
- Saving a new member automatically creates their portal login (login ID = their 10-digit mobile) with the default password `Shri@@1008`.
- Step 2 of the add-member dialog now shows the ready-made credentials (mobile + default password) with a Copy button, instead of asking the team to press "Create login".
- The member is still asked to set their own password the first time they sign in.
- If the automatic creation fails (for example an invalid mobile number), step 2 shows the reason and the existing manual "Create login" controls as a fallback.

Existing member profiles keep the current Reset password / Remove access controls, and a reset without a typed password now also uses the default `Shri@@1008` instead of a random string, so the team always hands over the same known password.

The QR poster instructions that mention an activation code are updated to say the front desk hands over the login details.

## Technical notes

- `src/pages/Auth.tsx`: remove the member-side `Tabs` (sign in / activate), the `code` state, and the `memberActivate` function (the `claim_member_account` RPC is no longer called from the client). Keep the mobile + password sign-in path unchanged.
- `src/components/wellness/CreateMemberDialog.tsx`: after `createMember` succeeds, call the existing `member-access` mutation with `action: "create"` and `password: DEFAULT_MEMBER_PASSWORD`, then show the returned credentials in step 2. Track success/error state to decide between the credentials view and the fallback `MemberLoginCard`.
- Add a shared constant `DEFAULT_MEMBER_PASSWORD = "Shri@@1008"` (in `src/hooks/useMemberIdentity.ts` or a small `src/lib/memberAccess.ts`) used by the create flow and the reset default.
- `src/components/wellness/MemberLoginCard.tsx`: prefill the password field with the default and note that leaving it blank uses the default password.
- `supabase/functions/member-access/index.ts`: when no password is supplied, use the default instead of `generatePassword()`. Keeps `must_change_password: true` so the first sign-in still forces a private password change.
- Copy-only updates in `src/components/wellness/QrPosterPanel.tsx` and `src/pages/WellnessQr.tsx`.
- No database or RLS changes.
