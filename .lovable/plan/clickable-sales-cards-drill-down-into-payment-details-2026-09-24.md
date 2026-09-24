# Clickable Sales Cards — Drill-Down into Payment Details

## Goal
Make the four "Sales & servings" tiles on the Dashboard (Today / This week / This month / Last month) clickable. Clicking a tile opens a slide-out sheet listing every membership sold in that period: member, plan, amount, payment mode (including split payments), New/Renewal, and date — with CSV export and a tap-through to the member's profile.

## Changes

### 1. New hook: `useSalesDrillDown` — `src/hooks/useWellness.ts`
- Inputs: `from`, `to` (IST dates), `memberMode`, `enabled`.
- Queries `wellness_memberships` created in the range (IST boundaries), joined to `wellness_members` (name, mobile, mode) and `wellness_plans` (name, price); filtered by `memberIdsForMode` like the other dashboard hooks.
- Fetches `wellness_payments` legs for those memberships and groups them by membership.
- Returns rows (member, plan, pricePaid, paymentMode, servings, isRenewal, createdAt, payment legs) plus totals: revenue, count, servings, and per-mode breakdown (cash / UPI / online / card). Mode tallies use split legs when present, else the membership's single mode.

### 2. New component: `SalesDrillDownSheet` — `src/components/wellness/SalesDrillDownSheet.tsx`
- Right-side sheet titled "Sales — {period label}" with the date range and an Export button.
- Summary tiles: Revenue, Plans sold, Servings, and per-mode badges (Cash ₹X, UPI ₹Y, …) with icons.
- Scrollable list of sales: member name + mobile, amount, plan badge, servings badge, New/Renewal badge, payment mode(s) with icons — split payments shown as "Cash ₹4,000 + UPI ₹3,500" — and IST date/time.
- Clicking a row closes the sheet and opens that member's profile via the existing `MemberSheetById` (memberId + onClose — `MemberDetailSheet` takes a member object, so the wrapper is the right fit).
- Export downloads a CSV (member, mobile, plan, amount, payment mode, type, date) named `sales-{period}-{from}-to-{to}.csv`.
- Data only loads while the sheet is open (`enabled: open`).

### 3. Dashboard wiring — `src/pages/WellnessDashboard.tsx`
- `SalesTile` becomes a `<button>` with hover highlight and pointer cursor; same numbers as today (still uses `useSalesAnalytics`).
- New state: `salesDrillDown { period, label } | null` and `selectedMemberId`.
- Renders `SalesDrillDownSheet` (respecting the current Physical/Virtual/All filter) and `MemberSheetById` for row tap-through.

## No database changes
All data comes from existing `wellness_memberships`, `wellness_payments`, `wellness_members`, `wellness_plans`. Purely frontend: one hook, one component, dashboard wiring.

## Verification
- Typecheck passes.
- Open the dashboard, click "This month": sheet shows the same total as the tile, rows match recent sales, split payments show both legs, Export downloads a valid CSV, and clicking a row opens the member profile.
