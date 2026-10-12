# Serving chart: match check-ins and show packed servings in their own colour

## What was found
- The chart counts only visits that took a serving off a membership. Trial visits, guest Day 2 visits and extra trial visits are recorded without that, so they are left out, even though the member was served at the club.
- That is why the chart sits below the check-in total every day. For example:
  - 10 Oct: 63 club check-ins, but 7 of them were trial visits, so the chart showed fewer.
  - 12 Oct (so far): 70 check-ins, 5 of them trials.
- Packed servings are mixed into the same bar as club visits, with no way to tell them apart.

## What changes
Each day's bar is split into two colours:
- **Club check-ins** (main colour): every member who checked in at the club that day, whether trial, guest or membership. This always equals that day's check-in total on the dashboard and in Attendance.
- **Servings issued** (second colour, stacked on top): the number of packed servings handed over that day, counted on the day they were given out. For example, 9 Oct shows 10 servings issued.

The chart also gets:
- A number on top of each bar with the day's total. Tapping or hovering shows the split, e.g. "Club check-ins 63 · Servings issued 10 · Total 73".
- A small legend explaining the two colours.
- A line under the title with the 30-day totals: club check-ins, servings issued and total servings.

The Physical / Virtual filter applies to both parts.

## Technical details
- `useServingTrend` (`src/hooks/useWellness.ts`):
  - **Club bucket:** count every paginated attendance row with `checkin_method <> 'serving_issue'`, regardless of `serving_deducted`.
  - **Issued bucket:** paginate `serving_transactions` where `txn_type = 'pack_and_issue'` within the window by `created_at`, apply the mode filter, and sum `-change` per IST date of `created_at`.
  - Return `{ date, club, issued, total }`.
  - Packed days covered by `serving_issue` attendance rows are not counted again.
- `ServingTrendChart.tsx`:
  - Two stacked `Bar`s on the same `stackId`. Club uses `--primary`; issued uses a theme accent token, with any new token added in `index.css`.
  - The total label sits on the top bar, with a custom tooltip, a legend and a summary line.
- Verify: compare the chart's club numbers for 8 to 12 Oct with the check-in counts, and the issued numbers with the database (3, 10, 3, 0, 0).
