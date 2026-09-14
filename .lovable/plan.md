# Member login check — end to end

I traced the member sign-in path and checked the live accounts. The flow already has **no email verification and no activation code**: the team creates the login, the account is confirmed at creation, and the member signs in with mobile number + password at `/auth` (Member tab).

## What is working

- Member tab at `/auth`: +91 mobile + password, no activation field anywhere.
- Accounts are created by the team (member profile > "Create login", and automatically in step 2 of Add member) with the default password `Shri@@1008`, already email-confirmed — nothing to click in an inbox.
- After sign-in the app routes to the member portal, or to the dashboard for team accounts.
- On first sign-in the member sees an optional "Set your own password" card in the portal — it does not block access.

## What I found broken

1. **One active member has no login at all** — Bharat Kalwani (9302113014). He cannot sign in today.
2. **Ten leftover member accounts** exist from the data reset for members who no longer exist (e.g. 7999412892, 9806172835, 9800000000/1, 9000000125, 9993236063, 9926088055, 8103514780, 9826789000, 9343959679). Anyone with those old passwords signs in and hits a dead-end "No access yet" screen.
3. **Members registered through the public `/join` form get no login**, so a lead promoted to member silently has no way in until someone notices.
4. **No way to see or fix this in bulk** — login status is only visible one member at a time.

## What I will do

1. Create the missing portal login for Bharat Kalwani (mobile + default password).
2. Remove the ten orphaned member accounts so no stale credential works.
3. Add a **"Portal logins" check** on the Members page: a small banner when any active member is missing a login, with a "Create missing logins" button that issues them in one go and lists the mobile numbers it created.
4. Make the login-status visible in the member list: a small "No login" marker on rows that have none.
5. Keep everything else as-is — no verification, no activation code, same default password.

## Technical notes

- Reuse the existing `member-access` edge function (`create` action) for both the one-off fix and the bulk button; it already handles the "auth user exists but is unlinked" case.
- Add a `bulk_status` action returning members with `user_id is null`, and delete the orphan `auth.users` rows via the admin API in a one-time run (not exposed in the UI).
- New hook `useMembersWithoutLogin()` in `src/hooks/useMemberAccess.ts` plus a banner component rendered on `src/pages/WellnessMembers.tsx`; list marker driven by the existing `user_id` field already selected for members.
- Leads are excluded from the banner; a login is created when a lead is converted to a member, same code path as Add member.
