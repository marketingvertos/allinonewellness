# Fix: Serving consumption chart stops after 6 Oct

## What was found
- The attendance data is complete. Every day from 7 to 12 Oct has records, about 60 to 70 servings a day. For example, 7 Oct has 71, 10 Oct has 62 and 12 Oct has 66 so far.
- The chart asks for the last 30 days of attendance, but the system returns at most 1,000 rows per request. At about 60 visits a day, 30 days is about 1,900 rows, so the list gets cut off after the first 1,000.
- That is why the bars stop: 6 Oct shows only 33 instead of 67, and every day after it shows nothing.
- The same cut-off will keep moving as more days are added, so the chart would always look "stuck" about two weeks back.

## The fix
- The chart reads every attendance row in the window, page by page, the same way the dashboard cards already do. Nothing is cut off any more.
- Each day's bar then shows that day's full count, including today.
- Packed servings for future dates (such as the ones already set for 13 and 14 Oct) are left out until that day arrives, so the chart only shows servings up to today.
- Days are worked out in India time from start to end, so the date labels stay correct around midnight.
- The Physical / Virtual filter keeps working the same way.

## Technical details
- `useServingTrend` in `src/hooks/useWellness.ts`:
  - Use `readAllMetricRows` (from `useDashboardMetrics.ts`) with `.order("id").range(from, to)` to paginate.
  - Add `.lte("visit_date", todayIst())` and compute `since` and the day buckets from `todayIst()` in IST, using UTC date math instead of the local `setDate`.
- Check the other attendance queries over long periods for the same 1,000-row cut-off, and paginate any that can exceed it (e.g. the attendance register and check-in reports).
- Verify: query the daily counts directly and compare them with the chart bars for 7 to 12 Oct in the preview.
