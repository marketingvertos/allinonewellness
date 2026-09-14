# Add a second super admin account

The account `Shri.chatap@yahoo.com` does not exist yet in the system (checked: only `demo@vertos.in` and `marketingvertos@gmail.com` currently hold admin access). So it needs to be created and then given full admin rights.

## Steps

1. Create the login `Shri.chatap@yahoo.com` with the password you provided, already email-confirmed so it works on first sign-in.
2. Give that account the `admin` role, which unlocks the full dashboard including Settings, WhatsApp, team and member management.
3. Verify the account and role exist, then confirm sign-in works on the Team / Admin tab of the login page.

## What changes for you

- Sign in at the login page using the Team / Admin tab with that email and password to get full access.
- Nothing changes for existing members or the other admin accounts.
- Recommendation: change this password after first sign-in, since it was shared in chat.

## Technical notes

- A short-lived admin edge function creates the auth user (`email_confirm: true`), inserts into `public.user_roles` with `ON CONFLICT DO NOTHING`, and is deleted right after — the same approach used for the previous admin account.
