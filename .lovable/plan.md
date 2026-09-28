# Member app Progress card: monthly gain/loss tracking + bar chart

## What changes (member home, Progress card)

1. **Dots replaced with a bar chart** — one bar per weigh-in showing the change from the previous reading (last 14 readings). Bars going up = weight increased (red), bars going down = weight reduced (green), no change = grey. Tapping a bar shows the date, weight and change.
2. **New "This month" summary** (calendar month, India time), shown as two tiles under the chart:
   - **Increased weight**: number of visits with a higher weight than the previous reading, and the total kg gained, e.g. "4 visits · +1.8 kg".
   - **Reduced weight**: number of visits with a lower weight than the previous reading, and the total kg lost, e.g. "9 visits · −3.2 kg".
   - A small line: **Net change this month** (gain + loss combined).
3. **Latest change** and **Total change** (since joining) stay as they are.

For a weight-gain member, colours flip (gaining is green, losing is red), matching how the card already works. Labels stay "Increased" and "Reduced" so the numbers mean the same thing for everyone.

## Rules
- Each reading is compared with the reading just before it — even if that earlier reading was last month — so the first visit of a month is counted correctly.
- Same weight as last time counts in neither group.
- Shows "No readings this month yet" when there are none.

## Technical notes
- Frontend only, in `src/pages/portal/PortalHome.tsx`; uses the already-loaded weight history (no database change).
- Compute deltas over the full sorted history, then filter to the current IST month (`en-CA` / `Asia/Kolkata` prefix) for counts and sums.
- Chart: recharts `BarChart` with per-bar `Cell` colours via semantic tokens (`--destructive`, emerald success class equivalent / `--primary`), `ReferenceLine y={0}`.
