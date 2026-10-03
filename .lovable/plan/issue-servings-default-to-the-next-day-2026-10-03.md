# Issue Servings: default to the next day

## What changes
When staff open **Issue Servings** for a member, the first serving date will be **tomorrow** (India time), not today. That's because a member who comes in today has already had today's serving at the club, so the pack they take home is for the next day.

- **Day 1** defaults to tomorrow (for example, issued on 3 Oct, so Day 1 = 4 Oct).
- More servings continue on the following days (5 Oct, 6 Oct, ...), the same way they do now.
- Staff can still pick any other date from the calendar, today included, if needed.
- **Issued on** stays as today: the history keeps the real date and time the pack was handed over (3 Oct).
- A short line under the dates explains it: "Issued today (03 Oct). Servings start from tomorrow because today's serving is taken at the club."
- If today's visit hasn't been marked yet, nothing is added automatically. Today's check-in still works the normal way.

## Where it shows
- In the Attendance register, an **S** appears on the serving dates (4 Oct onward), while today shows the normal check-in.
- In the serving history, the entry reads "Issued on 03 Oct, for 04 Oct to 06 Oct".

## Technical details
- `IssueServingsDialog.tsx`: the starting value and the reset when the window opens use `addIsoDays(todayIst(), 1)`. The fallback in the qty-expansion effect also starts from tomorrow. Add the helper text.
- No change to the database: `issue_servings` already uses `p_dates` for attendance rows and `created_at` for the issue time.
- Serving history label (`servingLabels.ts` / PortalHistory): add a "for <dates>" line when the attendance dates are different from the issue date. This uses the existing linked attendance rows.
