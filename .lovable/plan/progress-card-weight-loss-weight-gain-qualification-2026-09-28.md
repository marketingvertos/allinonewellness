# Progress card — Weight Loss / Weight Gain qualification

Add a qualification progress bar at the bottom of the member Progress card, below the consistency reward bar.

## Rules

- **Weight loss profile**: qualifies for the Family Day weight-loss reward when the **net change in the calendar month is −5 kg or more** (first reading of the month vs latest reading).
- **Weight gain profile**: qualifies for the Family Day weight-gain reward when the **net change is +3 kg or more**.
- Net change = latest reading this month − first reading this month (IST calendar month). Gains cancel losses — this is stricter than summing only good readings.
- If the member has fewer than 2 readings this month, show "Not enough readings this month yet" with the bar at 0.

## UI (bottom of Progress card)

- Section label matches the member's goal: "Weight loss qualification" or "Weight gain qualification" (never "Bait").
- Progress bar styled like the consistency bar: e.g. "2.9 / 5 kg" with a filled bar.
- When qualified: green state with "You qualify for the Family Day weight-loss reward" (or weight-gain).
- When not qualified: show how many kg still needed.
- For weight-gain members the bar fills on gained kg; for weight-loss members on lost kg. Colours follow the existing goal-aware meaning.

## Technical details

- File: `src/pages/portal/PortalHome.tsx` only — no database changes, no changes to reward eligibility rules.
- Reuse existing `history`/`sortedHistory` from `useWeightHistory`: filter to current IST month (same month prefix logic as `monthStats`), take first and last readings, compute net.
- Reuse the consistency bar's markup/styles for visual consistency; `gaining` flag already exists.
- Display-only on the member card; the Family Day section stays as it is.

## Verification

- Typecheck + build.
- Browser check as Pawan Tripathi (weight-loss profile) on desktop 1280×1800 and mobile 390×844: bar renders, kg numbers correct against his September readings, no label clipping, light/dark readable.
- Confirm a weight-gain profile member shows the 3 kg target variant.
