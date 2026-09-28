# Progress card — show gain/loss value on each chart bar

## What changes

On the member app Progress card bar chart (member home screen), each bar gets a
printed value label so the member can read the exact change for that visit
without tapping:

- A gain shows above its bar, e.g. **+0.2 kg**
- A loss shows below its bar, e.g. **−0.8 kg**
- No change shows a small **0.0** at the bar

Label text is coloured the same as the bar (green for a good change, red for a
bad one, grey for no change) so the direction is readable at a glance.

The tooltip keeps working exactly as today (it shows the day's full weight
reading, e.g. "now 74.5 kg"), so nothing is lost by keeping the bar label short.

## Layout adjustments

- Chart area grows slightly taller (h-36 → h-44) so labels never clip.
- Top/bottom chart margins widen a little to give labels breathing room.
- Label font stays small (10 px) so 14 bars still fit on a phone.

## Scope

- One file: `src/pages/portal/PortalHome.tsx` (the Progress card chart block).
- No data, database, or staff-side changes — labels are computed from the same
  per-reading deltas the chart already uses.
- Weight-gain members keep the swapped colour logic (gain = green) on both bar
  and label.

## Verification

- Build passes; open the member app home as a signed-in member and confirm each
  bar shows its +/− value in the right position and colour, including a 0.0 bar.
