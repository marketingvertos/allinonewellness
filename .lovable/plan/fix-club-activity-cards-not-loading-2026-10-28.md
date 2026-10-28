# Fix: Club activity cards not loading

## What is wrong
The dashboard "Club activity" cards stay blank (grey boxes) for every period. The loader asks the database for attendance with "visit date from 0 to 499" instead of the chosen dates, the database rejects it (error 400), and the whole card set fails. Trials and renewal payments are filtered the same broken way, so even when they don't error they return wrong rows.

## Fix
- In the dashboard numbers loader, rename the paging variables so they no longer overwrite the selected period's start/end dates. Trials, renewal payments and trial visits will then filter by the real dates (Today, this month, last month, etc.).
- If one part still fails, show a short "Couldn't load, retry" message on the cards instead of endless grey boxes.
- Add a small test confirming the date filters use the chosen period, not row numbers.

## Check
Open the dashboard as admin, switch Today / This month / last month, confirm numbers appear and tapping a card shows its list.

## Technical details
`src/hooks/useDashboardMetrics.ts`: the `readAllMetricRows((from, to) => ...)` callback params shadow outer `from`/`to`; rename to `(start, end)` and use `.range(start, end)`. Add error state in the dashboard card component.
