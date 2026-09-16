# Let members choose any simple password

Right now a member must type at least 8 characters, both when signing in and when setting their own password. Members find this heavy. After this change, any password they like will work — short and simple is fine.

## What changes for members

- Sign-in page: no length rule. Whatever the member types is sent as-is; if it is wrong they get the usual "check your mobile number and password" message.
- First-time "Set your own password" screen: the "At least 8 characters" hint is replaced with "Choose any password you like". The Save button only needs the two fields to match and not be empty.
- No other rules added: no uppercase, number or symbol requirement, no check against leaked-password lists.

## Note on the true minimum

The login service itself keeps a small floor of 6 characters for a *new* password. So a member setting a 3-character password would see an error from the service. To keep this friendly, the "Set your own password" screen will say "at least 6 characters" and show a clear message instead of a raw error. Signing in has no floor at all — existing passwords of any length work.

## Technical details

- `src/pages/Auth.tsx`: the member sign-in path already bypasses the zod schema (it calls `signInWithPassword` with `memberPassword`); confirm no length check there and leave the admin/team schema untouched at `min(8)`.
- `src/components/wellness/PortalPasswordPrompt.tsx`: change the placeholder text, relax the Save button condition from `password.length < 8` to `password.length < 6`, and surface `updateUser` errors as a plain toast.
- No backend, schema or data changes; the default staff-issued password `Shri@@1008` stays as is.
