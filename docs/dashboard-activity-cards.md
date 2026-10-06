# Dashboard activity cards

## Today's club activity (plan-specific cards)

The dashboard section "Today's club activity" shows ten plan-specific cards, all scoped to today in India time, all tappable, all honouring the Physical / Virtual filter. Every card's count and its drill-down list are built in the same loop in `src/lib/dashboardMetrics.ts`, so they can never disagree.

| Card | Definition |
| --- | --- |
| New guests today | Guest profiles whose joining date is today. |
| New Gold Card UMS ₹7,500 | Membership (renewed_from null) on a 30-serving, 30-day membership plan, starting today. |
| Gold Card UMS renewals | Renewal payment today linked to a 30-serving, 30-day membership plan; people counted once, split payments summed. |
| New White Card ₹3,750 | Membership (renewed_from null) on a 15-serving membership plan, starting today. |
| White Card renewals | Renewal payment today linked to a 15-serving membership plan. |
| 3-day paid trials ₹750 | Active 3-day trials started today on a priced trial plan. |
| 3-day free trials | Active 3-day trials started today with no plan or a ₹0 plan. |
| 3-day renewals ₹750 | Renewal payment today where the membership's plan is the paid 3-day trial plan. |
| One-day free trials | Active 1-day free trials (no plan or ₹0 plan) started today. |
| Guest day-2 visits | Free 3-day trials started yesterday with trial attendance marked today. |

Classification is by plan type and servings (not price), so cards stay correct if prices change. Other membership plans (e.g. the 10-day plan) are not covered by these cards. Renewals are driven by payments with context `renewal`; activations, unpaid rows and backdated payments are excluded. Each card opens `ActivityMembersSheet` with one row per person (name, mobile, Physical/Virtual badge, plan, date, amount) and links to the full profile.

## Implementation

- Pure calculation helper in `src/lib/dashboardMetrics.ts` (`calculateDashboardMetrics`, plan-family helpers).
- Read-only, paginated Supabase queries in `src/hooks/useDashboardMetrics.ts`: trials are loaded for yesterday and today's start dates; today's trial attendance feeds the guest day-2 card. No migration or new database function.
- Ten responsive cards in `src/components/wellness/DashboardActivityCards.tsx`.
- India-time date boundaries, 30-second refresh, midnight rollover, error/retry state.

## Validation

Unit scenarios cover plan-family classification, new versus renewal split, split-payment summing, trial started-today scoping, day-2 attendance joins, mode filters, IST midnight boundaries and empty data. GitHub checks run the Vitest suite and production build.
