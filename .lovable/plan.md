# Fix: members from the registration form can't sign in after a plan is activated

## What's wrong

People who register through the public form are saved as **Leads**, and a lead gets no portal login. When the team later activates a plan for that person, they become an active member — but no login is ever created, so their mobile number and password simply don't work at sign-in.

Confirmed in the live data: **Kulveer Singh Khalsa (9907045677)** registered through the form, has an active membership, and has no login at all.

A login is only created today in one place: the "Add member" screen. Selling a plan, converting a trial, or changing someone from Lead to Member never creates one.

## The fix

1. **Create the login automatically the moment someone becomes a paying member** — when a plan is activated, when a trial is converted, and whenever a member's status moves off "Lead". Mobile number + the standard password Shri@@1008, ready to use immediately.
2. **Fix the existing person now** — create Kulveer Singh Khalsa's login so they can sign in today, and sweep any other non-lead member missing one.
3. **Show the credentials after activating a plan** — a short confirmation with login ID, password and the portal link, with a copy button, same as the Add member screen.
4. **Make the warning harder to miss** — the "missing logins" notice currently only shows on the Members page; also show it on the Dashboard so nobody slips through.

Nothing changes for sign-in itself: still no email verification, no activation code, same default password.

## Technical notes

- Extend `member-access` with an idempotent `ensure` action (create only if `wellness_members.user_id` is null; reuse the existing create path and `must_change_password` metadata).
- Call `ensure` from the membership mutations in `src/hooks/useWellness.ts` (`create_membership`, `convert_trial_to_membership`) and from the profile-edit/status-change path, after the RPC succeeds and before invalidating queries. Failure is non-fatal: surface a toast, don't block the sale.
- One-off: run the existing `create_missing` action to issue logins for current non-lead members without one (Kulveer).
- Reuse `MissingLoginsBanner` on `src/pages/WellnessDashboard.tsx`.
- Add a credentials confirmation block to the plan-activation dialog reusing the copy-to-clipboard pattern from `CreateMemberDialog`.
