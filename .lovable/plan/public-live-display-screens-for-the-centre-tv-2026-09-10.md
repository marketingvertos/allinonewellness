# Public live display screens for the centre TV

Two full-screen boards anyone can open on a TV, tablet or projector — no login, refreshing themselves every minute.

## Screen 1 — Weight progress (`/display/weight-changes`)

- Daily / Weekly / Monthly buttons: change is measured against yesterday, 7 days ago or 30 days ago.
- Two sections: weight-loss members and weight-gain members, each ranked by total change since joining.
- Columns: rank, name, starting weight, current weight, change in the chosen period, total change.
- Colours: movement towards the member's goal is green, away from it is red.

## Screen 2 — Milestone board (`/display/milestones`)

- Toggle between Weight loss and Weight gain.
- One column per milestone (5 kg+, 10 kg+, … and 3 kg+, 6 kg+, … for gain), taken from the milestones already set up in Achievement settings — new ones appear automatically.
- Each member appears once only, under their highest milestone, exactly like the whiteboard at the centre.
- Column headers show the milestone icon and how many people are in it.

## Both screens

- Big, high-contrast text sized for viewing across a room; no menus or login chrome.
- Logo, board title and the current India time in the header; long lists scroll within the screen.
- Still readable on a phone.

## Admin access

A "Display screens" card on the dashboard with both links and a copy button, so the team can open them on the TV.

## Technical notes

- Migration: `display_weight_changes(p_period text)` and `display_milestone_achievers(p_category text)` as SECURITY DEFINER functions returning only names, goals and weights (no phone, email or ids), with `GRANT EXECUTE ... TO anon, authenticated`. Member filter uses the real statuses `active_member` and `renewal_due` (the brief's `expiring_soon` does not exist in this schema).
- Seed `weight_gain` milestone definitions (3/6/9/12 kg) only if none exist.
- Regenerate `src/integrations/supabase/types.ts` for the two new RPCs.
- New files: `src/pages/display/DisplayLayout.tsx`, `DisplayWeightChanges.tsx`, `DisplayMilestones.tsx`; both use React Query with `refetchInterval: 60000`.
- `src/App.tsx`: add the two routes outside `AppLayout` / `PortalLayout`.
- Highest-milestone dedupe happens in the frontend.
- Styling uses existing semantic tokens; display root forced to the light theme for TV readability.
- Verify with a TypeScript check and a signed-out browser load of both routes.
