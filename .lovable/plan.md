# Hide revenue on the dashboard + revenue period filter

## What changes
1. **Hidden by default.** The Revenue card shows `₹ • • • • •` instead of the amount. An eye button ("Show" / "Hide") reveals it.
   - Re-hides automatically when you leave the dashboard, reload, or after 60 seconds idle, so a number never stays on screen.
   - The same hide/show applies to the rupee amounts on the "Today's collection / New / Renewals / Trials" tiles (counts stay visible).
2. **Only admins can reveal.** Managers/front-desk staff see the masked amount with no Show button.
3. **Period filter** on the Revenue card (small dropdown), default "This month":
   - Today, This week, This month, Last month, Last 30 days, Last 90 days, This financial year (Apr–Mar), Custom range.
4. Under the amount (when revealed): split into New / Renewals / Trials and number of plans sold, plus % change vs the previous equal period. Tapping opens the existing sales detail panel for that period.
5. Member status badges (Lead, Active, Renewal due, Expired) stay visible as now.

## Technical details
- Extend `periodRange` in `useWellness.ts` with `last90`, `fy`, and a custom `{from,to}`; reuse `useSalesAnalytics(range, mode)` for totals/splits and a second call for the previous period.
- New `RevenueCard` component in `src/components/wellness/`; `useRevealMoney` hook (state in memory only, 60s timer, reset on unmount).
- Admin check via existing `has_role`/identity (`user_roles` admin) — UI masking only; no data/RLS change.
- `SalesDrillDownSheet` gets the selected range instead of fixed "today".
- Remove the old `revenueLast30Days` display from the card.
