# Show WLP evening sessions everywhere

## 1. Serving consumption chart
- Add a third bar segment, **WLP sessions**, in its own color (new theme color, distinct from blue club check-ins and the packed-servings color).
- Legend, tooltip, the 30-day summary line ("X club · Y issued · Z WLP · total") and the total on top of each bar all include WLP.
- WLP counts come from WLP check-ins on each session date (India time).

## 2. Attendance screen (daily / weekly / monthly / custom)
- New status **WLP** alongside Present at club, Serving issued and Absent.
- Calendar/register cells show a "W" mark for WLP attendance; a member who came in the morning and the evening shows both marks (e.g. "P·W").
- New stat tile: **WLP check-ins**; mode filter gets a "WLP" option.
- WLP does not inflate the "Present at club" count (same rule as packed servings), but counts as present for the 26-day consistency total.
- Excel and PDF attendance exports add the W mark and a "WLP" total column.

## 3. Other places
- Member profile attendance/serving history and member-app history: WLP visits listed with label "WLP session" and the serving used.
- Check-in report page and Club Reports daily/monthly: separate "WLP check-ins" figure.
- Dashboard "today" check-in card stays club-only; a small "WLP today" figure shown beside it.

## Technical details
- `useServingTrend`: paginated query of `wlp_checkins` joined to `wlp_sessions.session_date`, adding a `wlp` field per day; `--chart-wlp` token in `index.css` + tailwind.
- Attendance hooks merge `wlp_checkins` rows (mode `wlp`) into register data; exports updated in the same mapping.
- History views read `serving_transactions` with `wlp_deduction` label "WLP session".
- Club report RPCs extended with a `wlp_checkins` count (additive output field).
