# Expired members tap button in the "Low serving balance" card

## What you asked for
On the main dashboard, keep the "Low serving balance" card as the default, and add a tap button inside it that shows the list of expired-membership members with their details.

## Current state (verified)
- `src/pages/WellnessDashboard.tsx` renders the "Low serving balance" card (lines 203–224). It lists memberships with ≤ 5 servings; there is no expired-members view there.
- Members page already filters by status `expired` (`src/pages/WellnessMembers.tsx` uses `useWellnessMembers(search, status, ...)` with `status = "expired"`), and expired rows open the full profile sheet.
- `useWellnessMembers` in `src/hooks/useWellness.ts` returns full member rows (name, mobile, batch, mode, tags, etc.) — enough to show details and open the profile sheet directly from the dashboard.
- `MemberDetailSheet` (`src/components/wellness/MemberDetailSheet.tsx`) is reusable: props `{ member, open, onOpenChange }`.

## Plan (frontend only — no database change)

### 1. New component: `src/components/wellness/ExpiredMembersSheet.tsx`
- A side sheet listing members whose status is `expired`, respecting the dashboard's current Physical/Virtual/All filter.
- Uses the existing `useWellnessMembers("", "expired", "all", mode, "all")` hook — live data, same cache/refresh behaviour as the Members page.
- Each row shows: name, mobile, batch name, member mode badge (Physical/Virtual), joining date, and "Servings left: 0" style summary from the status.
- Tapping a row opens the full `MemberDetailSheet` for that member (profile, plan card, servings, history, actions) — same detail view the Members page opens.
- Empty state: "No expired members right now."

### 2. Dashboard card change: `src/pages/WellnessDashboard.tsx`
- In the "Low serving balance" card header, add a tap button: "Expired members" with a live count badge (e.g. `Expired members · 18`), styled consistently with the rest of the dashboard.
- Tapping it opens the new sheet. Card content (low-balance list) stays exactly as it is — this is the default card, unchanged.
- Count and list follow the same Physical/Virtual/All toggle as everything else on the dashboard.

### 3. Verification
- `npx tsgo --noEmit -p tsconfig.app.json` passes.
- Playwright check against the live preview: open the dashboard, tap the button, confirm the sheet lists expired members and a row opens the member's full profile.

## Not changing
- Expired logic itself (the recent rule — zero servings → expired, no check-ins for them) stays as-is.
- Members page, portal, check-in screens untouched.
