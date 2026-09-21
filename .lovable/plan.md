# Show servings left and days left, not "x of y"

Today both the member app and the staff profile show "35 of 66 servings left" with a filled bar. The total (66) is the plan's original allocation and only confuses people, especially after renewals stack servings on top.

## What changes

**Member app (My plan card)**
- Big number: servings left, with the word "servings left" under it.
- Second figure beside it: days left until the plan ends (e.g. "54 days left"), with the end date underneath as it is now.
- The progress bar and the "of 66" text are removed.
- "Renew online" button stays.

**Staff member profile (Plan tab)**
- Same two figures side by side: servings left and days left on the plan, plus plan name, code, dates and payment breakdown as today.
- Progress bar and "of 66 servings remaining" removed.
- All action buttons (Renew, Switch plan, Edit membership, Issue servings, corrections) stay.

**Member overview tiles**
- The "Servings left" tile drops the "of 66" subtitle and instead reads "Reduces by one per visit".
- The existing "Days left on plan" tile stays as is.

Where a plan has ended or days left is zero, the days figure reads "Expired" so nobody sees a negative number.

## Not changing

Serving deduction on attendance already works exactly as described — one serving per approved check-in. No database or logic change; this is display only. Dialogs that genuinely need the plan total (issuing servings, renewals, plan list) keep showing it.

## Technical notes

- `PortalHome.tsx`: replace the servings/Progress block with a two-figure row; compute days left from `end_date` in IST.
- `MemberDetailSheet.tsx`: drop `usedPct` and the `Progress` usage in the Plan tab; same two-figure row.
- `MemberDashboard.tsx`: change the "Servings left" tile `sub`.
- Add a small `daysLeftIst(endDate)` helper in `src/lib/formatters.ts` so both screens agree.
