# Run the WLP and Leads database setup

You don't need the SQL Editor — I apply these directly.

## Status
- **0051–0054 (WLP sessions, WLP serving type, staff guards, evening QR routing):** already applied and live. Nothing to run again.
- **0055 (Leads):** not applied yet. The file as written would fail, so I'll apply a corrected version.

## Fixes needed in 0055 before applying
1. Approving a lead writes `city` and `health_issues` onto the member profile — those fields don't exist there. Instead, city and health issues are saved as a note on the member (same as the public registration form does).
2. It looks up the free trial plan using `is_active`; the real field is `active`.
3. It writes the trial end date directly; the end date is calculated automatically, so that's removed (same bug we fixed in Change trial plan).
4. Anyone signed in could call "approve lead". Add a staff-only check.
5. Remove the direct public write to the leads table; the public trial form goes only through the submit function (which validates name and mobile). Public visitors can't read leads.
6. Approving a lead uses the joining date and India time as today; activation code kept as the profile requires it.

## Check
- Confirm the leads table and both functions exist.
- Submit a test lead as a visitor, approve it as staff, confirm a guest member + free trial is created, then delete the test records.
- Leads panel loads without errors.

## Technical details
- Apply 0055 via a migration with the corrections above (enums, table, indexes, grants: `authenticated`/`service_role` only on the table, `anon` EXECUTE on `submit_trial_lead`; RLS staff policy via `is_wellness_staff`).
- `approve_lead`: guard `is_wellness_staff(auth.uid())`; insert `member_notes` for city/health issues; trial insert omits `end_date`; plan lookup `active = true`.
- Update the repo's 0055 file to match the applied SQL.
