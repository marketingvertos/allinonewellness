# Fix: demo login ends on "No access yet"

## What I found

The demo sign-in itself is fine. I ran it end to end on both the preview and the live site: the demo button signs in and lands on the dashboard, and the demo account does hold the admin role in the database.

The failure you hit comes after sign-in. Right after signing in, the app asks the backend two questions — "does this account have a team role?" and "is it linked to a member profile?" — and if either request simply fails to reach the server (which happened in the preview: several requests errored with a network failure while the preview reconnected), the app treats the silent failure as a confident "no role, no member profile" and shows the "No access yet" screen. It then remembers that answer for five minutes, so retrying the demo button keeps showing the same screen until the cache expires.

## Plan

1. Stop treating a failed lookup as "no access". If either request errors, surface it as an error instead of an answer, and let the app retry automatically a few times.
2. Add a distinct state for "we could not check your access" with a "Try again" button, separate from the genuine "this account has no role yet" message.
3. Clear the cached access answer on every sign-in, so a fresh sign-in always re-checks rather than reusing a stale negative result.
4. Keep the negative answer short-lived instead of cached for five minutes.
5. Re-test: demo button in the preview and on the live site, plus a member sign-in, confirming each lands on the right screen.

## Technical notes

- `src/hooks/useMemberIdentity.ts`: destructure and throw `error` from both the `user_roles` and `wellness_members` queries in `queryFn`; set `retry: 2` and reduce `staleTime`; expose `isError`/`refetch`.
- `src/pages/Auth.tsx` and `src/components/AppLayout.tsx`: render a retry state when the identity query errors, keeping the existing "No access yet" copy only for a successful lookup that returns neither a role nor a member id.
- `src/contexts/AuthContext.tsx` (or the sign-in handlers): invalidate the `member-identity` query key on `SIGNED_IN` / `SIGNED_OUT` events.
- No backend, RLS or edge-function changes — the demo account, its admin role and the `demo-login` function all verified working.
