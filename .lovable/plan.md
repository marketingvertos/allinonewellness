# Show/hide password toggle for members

## What you get

An eye button inside password fields so members can see what they typed:

1. **First-time "Set your own password" screen** (member portal) — an eye icon on both "New password" and "Confirm password" fields. Tap to reveal, tap again to hide.
2. **Member sign-in** at `/auth` — same eye toggle on the password field, since members type the shared default password on first use and often mis-type it.

Behaviour: fields stay hidden (dots) by default; the toggle only changes that field; works on mobile and desktop.

## Technical notes

- `src/components/wellness/PortalPasswordPrompt.tsx` — wrap both `Input`s in a relative container with an absolute-positioned icon button (lucide `Eye` / `EyeOff`, `type="button"`, `aria-label` "Show password"/"Hide password") that flips the input `type` between `password` and `text`.
- `src/pages/Auth.tsx` — same treatment on the member password field (`memberFields`). Team/admin fields left unchanged unless wanted.
- No backend, no data changes. Typecheck after edits.
