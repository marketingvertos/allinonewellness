# Dashboard activity cards

## Plan

Add eight cards below the existing dashboard summary, using the existing card style and Physical / Virtual / All filter.

| Card | Definition |
| --- | --- |
| New members today | Non-guest members whose first non-cancelled membership starts today. Leads and trial-only profiles are excluded. |
| New members this month | The same first-membership rule, from the first day of the current India-time month through today. |
| New 30-day UMS | The new-member monthly subset whose first plan is UMS with a 30-day duration. |
| UMS renewals today | Distinct members with a positive renewal payment dated today, linked to a UMS membership. |
| Daily renewals today | Distinct members with a positive renewal payment dated today, linked to a paid one-day plan. |
| 3-day paid trials | Distinct members with an active, already-started, unexpired three-day trial linked to a plan priced above zero. |
| 3-day free trials | The same trial window, with a zero-price plan or no plan (including the three-day guest option; one-day guest trials are excluded). |
| New guests today | Current guest profiles whose joining date is today. A guest converted to a member is no longer counted here. |

Renewal cards represent purchases, as requested, rather than upcoming expiry. Split payment lines count once per member. Extended, queued and replacement renewals are included through payment context `renewal`; activation payments and unpaid renewals are excluded. Backdated payments follow `paid_at`, not creation time. The current schema does not snapshot the purchased plan on individual payment lines, so classification uses the linked membership's plan.

UMS plans follow the club report's 15/30-serving membership families (excluding one-day plans). UMS 30 additionally requires a 30-day duration and 30 plan servings, matching the current network qualification rule. Daily plans use one-day duration and a positive list price. Discounts do not change classification. All plan rows, including deactivated plans still referenced by records, are loaded.

## Implementation

- Pure calculation helper in `src/lib/dashboardMetrics.ts`.
- Read-only, paginated Supabase queries in `src/hooks/useDashboardMetrics.ts`; no migration or new database function.
- Eight responsive cards in `src/components/wellness/DashboardActivityCards.tsx`.
- India-time date boundaries, 30-second refresh, midnight rollover, error/retry state.
- Existing dashboard cards and operational workflows remain in place.

## Validation

Unit scenarios cover first-purchase history, renewals and switches, guest/cancelled/future records, split and extended payments, queued plans, backdated payments, India-time midnight, trial plan prices and dates, member mode filters, and empty data. GitHub checks run the Vitest suite and production build.

## Delivery

Push the validated changes to `main`, which this repository's README identifies as the Lovable synchronization branch. Synchronization into the editor and publication of the hosted app are separate states; verify the connected hosting environment before claiming the live app is updated.
