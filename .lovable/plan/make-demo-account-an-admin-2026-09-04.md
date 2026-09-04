# Make demo account an admin

The demo login (`demo@vertos.in`) currently has the default `rep` role, so it can't open Settings → WhatsApp. The fix is a data change only — no code or schema edits.

## Steps

1. Give the demo user the `admin` role in `user_roles` (alongside its existing role), so Settings → WhatsApp and all other admin/manager screens unlock for it.
2. Verify by confirming the role row exists, so the next demo sign-in lands with full admin access.

## What changes for you

- Sign in with the demo account → full admin access, including Settings → WhatsApp to paste the API credentials.
- Nothing else changes for other members or staff.

## Technical notes

- Single `INSERT ... ON CONFLICT DO NOTHING` into `public.user_roles` for the demo user's id — safe to re-run, no duplicates.
