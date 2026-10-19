# Fix blank screen when opening a trial member's profile

## What was found
- Clicking a name on the Trials page opens the profile panel straight away with only basic details: name, mobile number and status. The rest of the profile loads a moment later.
- The panel header shows "Joined <date>". On the Trials page the join date isn't loaded yet, and the date formatter throws an "Invalid time value" error when it gets a missing date. That error crashes the whole screen, so it goes blank.
- Other lists that open the profile with partial details can hit the same crash.

## The fix
1. Make the shared date formatter safe. A missing or invalid date shows "—" and no longer crashes the screen. This protects every screen that shows dates, not just this one.
2. Load the join date (and tags) with the trial list, so the profile header is complete from the first moment.

## Technical details
- `src/lib/formatters.ts`: in `formatDate` and `formatDateTime`, accept `string | Date | null | undefined` and return "—" when the value is empty or `isNaN(new Date(v).getTime())`.
- `src/hooks/useWellness.ts` (active and recently ended trial queries, around lines 1677 and 1702): add `joining_date, tags, member_mode` to the `wellness_members(...)` select.
- Verify: open a trial member from the Trials page in the preview, signed in, and confirm the profile renders with no console error.
