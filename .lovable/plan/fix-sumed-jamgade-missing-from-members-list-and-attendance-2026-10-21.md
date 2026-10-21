# Fix: Sumed Jamgade missing from Members list and Attendance

## Why it happens
- Sumed came in as a **guest trial** (marked "guest" in the system). On 18–19 Oct the trial ended and he was moved onto **NEW Gold Card UMS-7500**. That plan is active with 30 servings left.
- The Members list and Attendance page leave out anyone still marked "guest". The "guest" mark is only cleared on one conversion path. The path used for Sumed didn't clear it, so he still counts as a guest and is hidden. He is the only member in this state right now.

## Fix
1. **Correct Sumed now:** remove his guest mark. He will show up straight away in Members, Attendance, birthdays and the other lists.
2. **Permanent fix:** the system clears the guest mark automatically whenever a guest gets a paid plan (a membership or a paid trial), whichever button or screen staff use. This happens in the database, so no path can skip it.
3. **Clean up past cases:** clear the mark for anyone else who has a paid membership but is still marked guest. Today that is only Sumed.

## Technical details
- Data fix: `update wellness_members set is_guest=false where is_guest and exists (membership row)`.
- Migration: an AFTER INSERT trigger on `wellness_memberships`, plus one on `wellness_trials` when the plan price is above 0, that sets `wellness_members.is_guest=false`. Read the trigger back after applying it, because earlier migrations didn't apply live. If it doesn't apply, add the same step to the `member-access` convert actions instead.
- Remove the client-side-only `is_guest:false` update in `useWellness.ts` (around line 409), because the trigger replaces it.
- Verify: Sumed appears in Members and in Attendance for 18, 19 and 21 Oct.
