# One login page for members and the team

Today there are two separate sign-in screens: `/auth` (email + password for staff) and `/portal/auth` (mobile + password for members). This merges them into a single page with a switch, and makes the destination after sign-in depend on the account's role.

## What the user sees

One page at `/auth`:

- A segmented switch at the top: **Member** (selected by default) and **Team / Admin**.
- **Member** view (default): +91 mobile number + password, plus the existing "Activate account" option with the front-desk activation code.
- **Team / Admin** view: email + password, Google sign-in, Try demo, and the sign-up link — exactly what the current staff screen offers.
- The "Are you a member?" / "Sign in to the member portal" cross-links are removed; the switch replaces them.
- Brand panel, logo and styling stay as they are today.

`/portal/auth` keeps working as a redirect to `/auth` so printed QR posters and old links do not break.

## Roles decide where you land

After a successful sign-in (from either side of the switch), the app resolves the account:

- Has a staff role → the admin dashboard with the full sidebar.
- Is a wellness member with no staff role → the member portal.
- Neither → a clear "no access yet, contact the centre" message instead of a redirect loop.

This is the behaviour the layouts already enforce; the plan makes it explicit and consistent from a single entry point, so an account promoted to admin automatically gets admin features on next sign-in with no change to how they log in. Default remains member-level.

## Technical notes

- Rewrite `src/pages/Auth.tsx` into a two-mode screen. Reuse the mobile/activation logic from `PortalAuth.tsx` (`mobileToEmail`, `normalizeMobile`, `claim_member_account` RPC) and the existing email/Google/demo logic. Mode is held in local state, defaulting to `member`, and reflected in a `?mode=team` query param so a bookmark can open the team side directly.
- Delete `src/pages/portal/PortalAuth.tsx` usage: route `/portal/auth` to `<Navigate to="/auth" replace />`, preserving any `next` param.
- Add a small shared redirect helper driven by `useMemberIdentity()`: staff → `/dashboard`, member → `/portal`, otherwise show the no-access state. `Auth.tsx` waits for identity to resolve before redirecting instead of hardcoding `/dashboard`.
- `AppLayout` and `PortalLayout` guards point at `/auth` for unauthenticated users.
- No database or RLS changes: roles already live in `user_roles` and are read through `useMemberIdentity`.
