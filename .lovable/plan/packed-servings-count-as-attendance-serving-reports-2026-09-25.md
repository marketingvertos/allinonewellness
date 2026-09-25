# Packed servings count as attendance + serving reports

When staff pack servings for a member, they pick the dates the servings cover. Each date shows as present in the Attendance register, marked "S" instead of a tick. A new dashboard card and a Serving Reports page show who received packed servings.

## What changes

**Issue servings dialog**
- Below the quantity, one date per serving appears, starting today and running on consecutive days (today, tomorrow, the day after...).
- Any date can be changed. The same date cannot be picked twice.
- Dates where the member already has attendance are flagged in the dialog ("already present, will be skipped"). The serving is still deducted.

**Attendance register**
- Days covered by packed servings count as present and show an amber "S". Club visits keep the green tick. A small legend explains the marks.
- Each member's totals show the split, e.g. "25/30 (83%): 20 visits + 5 servings". The Excel export uses "S" for those days.

**Dashboard**
- A new "Servings issued today" card sits after Sales & servings. It shows the total and how many members received them, and follows the Physical/Virtual/All filter.
- Tapping it opens a list: member, mobile, quantity, reason, time. Tapping a name opens the profile.

**Serving Reports page (new, in the sidebar after Reports)**
- Today / This week / This month / Last month / Custom, plus Physical/Virtual/All and a search box.
- Tiles for total servings, members, and average per member.
- An issue log with the dates each pack covered, a member-wise summary, and a CSV export.

## Rules and safeguards
- **No WhatsApp message for packed days.** Today every new attendance entry sends the check-in confirmation automatically, so packed days are excluded from that.
- **One attendance per member per day.** The database already allows only one attendance entry per member per day. If a member already has packed servings for today and then comes in, the check-in screen will say "Serving already issued (packed) for today" and will not take a second serving. Say so if you would rather allow it.
- Packing without dates (older behaviour) still works.
- Consumption charts that count servings from attendance will now also count packed days, on the dates they cover.

## Technical details
- Migration 1: `ALTER TYPE public.checkin_method ADD VALUE IF NOT EXISTS 'serving_issue';` in its own migration.
- Migration 2: replace `issue_servings` with a version that takes `p_dates date[] DEFAULT NULL`. It keeps the existing guards (staff check, row lock, 1 ≤ qty ≤ remaining). It checks that the number of dates matches the quantity and that there are no duplicates. It inserts attendance with `checkin_method='serving_issue'`, `visit_time = date 09:00 IST`, `serving_deducted=true`, the balance snapshot and `staff_id=auth.uid()`, using `ON CONFLICT (member_id, visit_date) DO NOTHING`, which matches the existing unique index. It stores the covered dates in the transaction note or a returned jsonb. Drop the old 3-argument version so there are no ambiguous overloads.
- Update `queue_checkin_notification()` to `RETURN NEW` early when `NEW.checkin_method = 'serving_issue'`.
- Update `checkin_member` / `approve_checkin_request` / `member_self_checkin`: when today's row exists with method `serving_issue`, return a clear message.
- Regenerate types.
- `useWellness.ts`: add `dates` to `useIssueServings` and invalidate attendance, dashboard and serving-report keys. Add `useTodayServingsIssued` and `useServingsIssuedReport`, both filtered by mode through the existing member-mode helper. Change `useAttendanceRegister` so `dayMap` becomes `Record<string, "visit" | "serving" | null>`, with `visitDays` and `servingDays` counts.
- Update `IssueServingsDialog.tsx` (shadcn date pickers with `pointer-events-auto`, IST dates as YYYY-MM-DD), `WellnessAttendance.tsx`, and `WellnessDashboard.tsx`.
- New `ServingsIssuedSheet.tsx` and `pages/ServingReports.tsx`, a `/serving-reports` route, and a sidebar item.
- Colours use theme tokens, not hard-coded amber or green classes.
