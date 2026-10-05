# Sales & servings row — Today only, with split cards

## What changes

The "Sales & servings" row on the dashboard currently shows four period cards (Today, This week, This month, Last month). It becomes a Today-focused row:

```text
[ Today's collection ] [ New today ] [ Renewal today ] [ Trial today ]
   ₹ total · sold ·       ₹ new          ₹ renewal        ₹ trial
   servings               count          count            count
```

- **Card 1 — Today's collection:** today's total revenue, plans sold, and servings used. Plain total, no split lines.
- **Cards 2–4 — the split of today's collection:** New memberships, Renewals, and Trials for today only, each showing its revenue and count.
- **All four cards clickable:** each opens the existing sales detail panel, pre-filtered to today and to that card's segment (All / New / Renewal / Trial), with member names, plans, amounts, payment modes, CSV export, and profile links — same as today.
- **Removed:** This week, This month, and Last month cards, and all other split/top-plan text inside the cards.

## Technical details

- `src/pages/WellnessDashboard.tsx`
  - Replace the `PERIODS` loop with a fixed 4-tile row: one `useSalesAnalytics(periodRange("today"))` call shared by all tiles (single query, no extra load).
  - Tiles: Today (total), New (`newRevenue`), Renewal (`renewalRevenue`), Trial (`trialRevenue`) — zero-value tiles still render and stay clickable.
  - `salesDrillDown` state gains a `segment: "all" | "new" | "renewal" | "trial"` field.
- `src/components/wellness/SalesDrillDownSheet.tsx`
  - Accept an optional `segment` prop; filter `data.rows` client-side (trial = plan type trial, renewal = `isRenewal`, new = the rest), adjust the sheet title (e.g. "Sales — Today · Renewals"), and keep CSV export matching the filtered rows.
  - `useSalesDrillDown` rows need the plan type exposed if not already present (check `src/hooks/useWellness.ts`; add `planType` to the row select if missing).
- No database or backend changes. Existing drill-down behaviour (split payments, profile links, export) is unchanged.

## Verification

- Typecheck/build clean.
- Preview check: row shows 4 today-based cards, each opens the correctly filtered detail panel.
