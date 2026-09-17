# Fix: blank screen when opening a member profile

## What is happening

Opening a member's profile turns the screen blank. This started with the new payment breakdown added to the member's plan card.

The payment lookup was added in the wrong place in the profile code — after the point where the profile stops early while the member is still loading. React does not allow that, so the moment the member's details arrive the whole screen crashes instead of rendering.

## The fix

Move the payment lookup above the early exit in the member profile, so it always runs in the same order on every render. Nothing about the payment breakdown itself changes — it still lists each payment's method, reference, date and amount under the active plan.

## Technical detail

- `src/components/wellness/MemberDetailSheet.tsx`: `usePaymentHistory(activeMembership?.id)` is currently called at line 183, after `if (!member) return null;` (line 170) — a conditional hook call that triggers "rendered more hooks than during the previous render".
- Compute `activeMembership` (derived from `memberships`, available before the guard) and call `usePaymentHistory` above line 170, leaving the remaining derived values where they are.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json` and by opening a member profile in the preview.
