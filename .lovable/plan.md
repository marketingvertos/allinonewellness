# Count WLP servings in Club Owner Report totals

## What is wrong today
- **Daily register:** "Total Shake" and "Daily Shake" both show only morning club visits. The WLP column is shown next to them but is not added into the total, so the bottom Total row and the "Total Shakes" card leave WLP out.
- **Monthly report:** "Total Shake" counts only morning club visits. WLP check-ins are not counted at all.
- Downloads (Excel/PDF) copy the same numbers, so they have the same gap.

## What will change
- **Daily Shake** = morning club servings for that day (unchanged).
- **WLP** = WLP (Balanced Living Programme) check-ins on that session date (unchanged).
- **Total Shake** = Daily Shake + WLP, for every day, the week rows, and the month's Total row.
- "Total Shakes" card at the top includes WLP; the WLP card stays as is.
- **Monthly report "Total Shake"** = club servings + WLP check-ins for the month. A separate "WLP Servings" line is added under it so you can see the split.
- Excel and PDF downloads (daily, weekly, monthly) show the same numbers.
- Packed servings (S) keep counting the way they do today; no change to member balances or attendance.

## Check
- Compare October 2026: for 14 Oct and 21 Oct (WLP days), confirm Total = Daily Shake + WLP, and the monthly Total Shake equals the sum of the daily totals.
- Add a small test for the rule "Total Shake = Daily Shake + WLP".

## Technical details
- New migration updating `get_club_daily_report` to also return `daily_shake` (club attendance) and `wlp` (count of `wlp_checkins` joined to `wlp_sessions.session_date`), with `total_shake = daily_shake + wlp`.
- Update `get_club_monthly_report` the same way, adding `daily_shake` and `wlp` keys.
- `useClubReports.ts`: drop the client-side WLP fetch and use the RPC fields; update types.
- `ClubReports.tsx`: "Daily Shake" column reads `daily_shake`; monthly table adds WLP row.
