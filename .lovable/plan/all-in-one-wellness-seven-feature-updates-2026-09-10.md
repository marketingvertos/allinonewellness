# All In One Wellness — seven feature updates

Implements the uploaded brief in full. Two new member fields come first because the rest build on them.

## 1. Member mode and tags (data)

Add to the member record:
- **Mode** — Physical or Virtual (defaults to Physical for everyone who exists today).
- **Tags** — any of Coach, Preferred Customer (PC), MRP Customer; a member can carry more than one, and it is optional.

Both appear when adding a member (mode is required, shown at the top of the form) and can be changed later from Edit member. Tags show as small badges on the member profile header.

## 2. Date of birth picker with age

New date field used on Add member, Edit member and the member profile: three boxes **DD / MM / YYYY** that jump forward as you type, plus a calendar you can open with quick month and year selection so old birth years take one tap. Straight under it: "Age: 33 years", worked out on today's Indian date.

Gender already offers Female / Male / Other — no change.

## 3. Dashboard split by mode

A **Physical | Virtual | All** switch at the top of the dashboard. Every number and chart on the page — members, check-ins today, active memberships, trials, revenue, low balance, renewals due, top referrers, birthdays, serving trend, pending check-ins — follows the switch. The choice stays in the page address so it survives a refresh and can be bookmarked.

## 4. Sales and servings analytics

New **Sales & Servings** section on the dashboard: memberships sold and revenue for today, this week, this month and last month, plus servings used in each period.

On Check-in reports: quick buttons for Today, This Week, This Month, Last Month, Last 30 Days and a custom start/end date range, showing total check-ins, memberships sold, revenue and average daily check-ins for the chosen range.

## 5. Members list filters

Next to the existing status filter: a **Mode** filter (All / Physical / Virtual) and a **Tag** filter. Each row shows a mode badge and its tag badges. The CSV download gains Mode and Tags columns.

## 6. Servings on check-in search

Each member found on the check-in screen shows "12 servings left", an amber **Low servings** badge at 5 or fewer, and a red **No servings** badge at zero, plus their tag badges.

## 7. Clickable dashboard cards

The status counts on the revenue card (Lead, Trial, Active member, Renewal due, Expired) become links into the members list already filtered to that status. The Total members, Check-ins today, Active memberships, Active trials and Renewals due cards become links too. The members page reads the status from the address so those links land pre-filtered.

## Technical notes

- Migration on `public.wellness_members`: `member_mode text not null default 'physical'` with a check constraint of `physical`/`virtual`, and `tags text[] not null default '{}'`; GIN index on `tags`, btree on `member_mode`. Existing RLS and grants unchanged. Regenerate `src/integrations/supabase/types.ts`.
- New `src/components/ui/dob-input.tsx` (segmented DD/MM/YYYY + shadcn Calendar popover with month/year dropdowns, emits `YYYY-MM-DD`) and an `ageFromDob` helper in `src/lib/formatters.ts` using `Asia/Kolkata`.
- `src/hooks/useWellness.ts`: extend `useWellnessMembers(search, status, categoryId, memberMode, tags)`; add `memberMode` params to `useWellnessStats`, `useActiveMemberships`, `useActiveTrials`, `useTopReferrers`, `useTodayAttendance`, `useServingTrend`, `useUpcomingBirthdays`, `usePendingCheckIns`, `useUpcomingRenewals` (filter by member ids of that mode where a direct join is not available); add `useSalesAnalytics(range)` over `wellness_memberships.created_at`/`price_paid` and `useServingsAnalytics(range)` over `serving_transactions` where `txn_type = 'daily_deduction'`. All query keys include the new params.
- Mode filter state on the dashboard and members page held in `useSearchParams` (`mode`, `status`, `tag`).
- Check-in search: one extra lookup of active memberships for the visible member ids, mapped to `remaining_servings`, rendered through `WellnessListRow` badges.
- All new controls mobile-first and token-based so light and dark themes both work. No changes to portal, QR or notification flows.
