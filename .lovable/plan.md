# Badge visuals and goal-aware milestones

Two changes to the achievements experience: make badges look like real badges, and stop showing milestones that are far beyond the member's own goal.

## 1. Goal-aware milestone visibility

Today every active weight milestone is listed, so a member aiming to lose 12 kg still sees locked cards up to 70 kg. New rule for the weight-loss / weight-gain ladder:

- Work out the member's goal delta from their starting weight and target weight (for example 82.7 kg start, 70 kg target = 12.7 kg goal).
- Show milestones up to the first milestone at or above the goal, plus one stretch milestone beyond it.
- Never show fewer than the first 20 kg of milestones (loss) or the full short gain ladder — so a small goal still shows a meaningful journey.
- Only show milestones beyond 20 kg when the member's goal actually exceeds 20 kg.
- Any milestone already unlocked always stays visible, even if it sits past the cap.
- If no target weight is recorded, fall back to the 20 kg cap.
- A small line under the list says how many further milestones exist beyond the member's current goal, so nothing feels hidden.

The community/referral ladder keeps showing the full ladder (titles are aspirational there), but rendered as badges.

## 2. Real badge visuals

Replace the plain bordered rows and pills with a badge component:

- Circular medallion with a tier colour ring, the emoji/icon in the centre, and the milestone name underneath.
- Unlocked badges are full colour with a subtle glow and a small unlock date; locked ones are muted grey with a lock icon overlay.
- Weight milestones render in a responsive badge grid instead of a stacked list.
- Referral titles render as the same badge shape (smaller size) instead of text pills.
- The next milestone gets a highlighted "in progress" ring with the progress percentage.
- Tier colours are driven by milestone position (bronze → silver → gold → platinum → diamond → crown) using existing design tokens, so it works in dark mode.

The header stats (Starting / Current / Lost) and the progress bar stay, with slightly stronger typography.

## 3. Small data correction

The seeded weight-loss ladder has "50 Kg-10th Mile Stone" stored with a threshold of 55, duplicating the 55 kg milestone. Correct it to 50 so the ladder steps evenly.

## Technical notes

- New `src/components/wellness/MilestoneBadge.tsx` — presentational badge (size, tier, locked/unlocked, in-progress states).
- `buildLadder` in `src/hooks/useAchievements.ts` gains an optional `goal` argument returning a `visible` milestone list plus a `hiddenCount`, leaving the unlock logic untouched.
- `AchievementsPanel.tsx` computes the goal delta from `initial_weight`/`target_weight` (falling back to the first recorded weight), passes it to `buildLadder`, and renders badge grids.
- Panel props extend with `targetWeight`; the staff member sheet and portal home already pass the full member record, so no route changes.
- Milestone unlocking in the database is unchanged — this is display filtering only, so members keep credit for anything already earned.
- One data update on `achievement_definitions` for the threshold correction.
