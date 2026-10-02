# Make the "New members, renewals & trials" cards tappable

## What you'll get
All 8 cards in this section (New members today, New members this month, New 30-day UMS, UMS renewals today, Daily renewals today, 3-day paid trials, 3-day free trials, New guests today) will open a side panel when tapped, the same way the Low Serving Balance / Expired / Sales cards do.

Each panel shows:
- Card title and the number of people (always matches the card number)
- One row per person: name, mobile, Physical/Virtual badge, plan name, and the relevant date (membership start, renewal payment date and amount, trial start–end, or guest joining date)
- A tag per row such as "New", "Renewal", "Paid trial", "Free trial", "Guest"
- Tap any person to open their full profile
- Friendly empty message when the count is 0 (card still tappable)

The Physical/Virtual filter at the top of the dashboard applies to the lists too.

## Technical details
- `src/lib/dashboardMetrics.ts`: `calculateDashboardMetrics` additionally returns `lists` — per card key, an array of `{ memberId, planId, date, amount?, label }` built in the same loops that produce the counts (so numbers and lists can never disagree). Counts stay as they are; existing unit tests keep passing, plus a test that each list length equals its count.
- `src/hooks/useDashboardMetrics.ts`: also select `full_name, mobile_number` for members so rows can render without extra queries.
- New `src/components/wellness/ActivityMembersSheet.tsx`: Sheet styled like `ExpiredMembersSheet`; rows open `MemberSheetById`.
- `DashboardActivityCards.tsx`: each card becomes a button (hover/focus styles matching other clickable tiles, keyboard accessible) that opens the sheet for that card key.
- Frontend only; no database changes.
