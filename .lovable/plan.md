# Member Progress card: attendance and consistency

## What members will see
- Give the weight-change chart and monthly figures more breathing room so bar labels, dates, visit counts, and kg totals remain readable on a phone. Keep the existing gain/loss colors and goal-aware meaning; display visit counts and kg totals on separate lines when space is tight.
- Add **Maintained this month** for readings unchanged from the previous weigh-in. This is a count of weigh-ins, not a count of attendance days; unchanged readings remain excluded from increased/reduced totals.
- Add **Present this month** and **Absent this month** to the same Progress card. Present counts distinct recorded attendance dates, including packed servings marked “S”; absent counts elapsed dates in the current calendar month without an attendance record, through today only. Future dates are not absent.
- Add a **Consistency reward** progress bar showing present days out of 26. At 26 or more, show the existing qualification message; otherwise show days still needed. Show this even when there is no upcoming Family Day. Keep Family Day event details in their own section, avoiding a duplicate attendance/eligibility summary there.

## Technical details
- Update the member home Progress card in `src/pages/portal/PortalHome.tsx`. Reuse `useMyMonthlyAttendance`, which counts distinct `wellness_attendance.visit_date` rows for the IST calendar month without the recent-60-record limit of the general attendance history hook. This also follows the current 26-distinct-day reward calculation.
- Calculate elapsed days from the first of the month to `todayIst()` (inclusive); absent = elapsed days − present days, clamped to zero. Keep the existing monthly weight delta series and use its `sameCount` for maintained weigh-ins.
- Use the existing `Progress` UI control and semantic styling. Preserve current recording and chart interactions, and check both small-screen and desktop layouts for label clipping and wrapping. No database changes or changes to reward eligibility rules.
