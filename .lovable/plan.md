# Monthly activity view on the dashboard + plan filter on Members

## What you will get

### 1. Dashboard: "Today / This month / Pick a month" switch
- The "Today's club activity" section gets a period switch: **Today** (default), **This month**, **Last month**, and a **month picker** (any past month, e.g. September 2026).
- All ten cards (New guests, New Gold Card UMS ₹7,500, Gold Card renewals, New White Card, White Card renewals, 3-day paid trials, 3-day free trials, 3-day renewals, One-day free trials, Guest day-2 visits) show counts for the chosen period, India time.
- Tapping a card still opens the list of people, now for that month, with a **Download Excel** button.
- Physical / Virtual filter keeps working.

### 2. Members tab: Plan filter + download
- New **Plan** dropdown next to Status / Mode / Tag:
  - Any plan, Gold Card UMS (30), White Card (15), Paid trial, Free trial / guest, each individual plan you created, No plan.
- New **Type** dropdown: All, New, Renewal (based on payment type).
- New **Month** dropdown: Any time, This month, Last month, or a picked month — filters by when the plan started (new) or was paid (renewal).
- Example: Plan = Gold Card UMS, Type = New, Month = September 2026 shows every new Gold Card member in September.
- **Export** downloads exactly the filtered list, adding Plan, Type (New/Renewal), Start date, Amount paid and Servings left columns.
- Filters stay in the page address so a dashboard card can link straight to the matching Members list ("See all in Members").

## Technical details
- `dashboardMetrics.ts`: generalise `calculateDashboardMetrics` from a single `today` to a `{from, to}` IST date range (today = from=to); same loop builds counts and lists. Day-2 visits: trials started the day before each attendance date in range.
- `useDashboardMetrics(mode, range)`: trials/payments/attendance queried by range with pagination (existing `readAllMetricRows`); query key includes range.
- `DashboardActivityCards`: period selector; titles change "today" → period label; `ActivityMembersSheet` gets Excel export via `downloadXlsx`.
- Members page: new hook reading memberships, trials and renewal payments (paginated) and producing a member-id → {planFamily, type, date, amount, remaining} map, reusing the plan-family helpers from `dashboardMetrics.ts` so cards and filter always agree. Revenue/renewals use `wellness_payments` per the sales-ledger rule.
- Unit tests added to `dashboardMetrics.test.ts` for month ranges (Sept boundaries in IST, new vs renewal within a month).
- No database changes.
