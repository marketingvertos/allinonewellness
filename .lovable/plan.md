# Show "Daily Paid" when converting a trial

## Why it is missing
- The Daily Paid plan (₹300, 1 visit) exists and is switched on, so the problem is not the plan setup.
- In the preview, the latest Trials page already lists every paid trial under **Paid trials**, including Daily Paid. The only plan it leaves out is the one the person is already on.
- Your live site (club.weightlossmentorshri.com) still has the older Trials page. That version hides the whole Paid trials section once someone is on a paid trial. That is why Daily Paid does not appear.

## Fix
1. Publish the current version so the live Trials page gets the updated list.
2. Make the same change in the member profile's trial section. Its Convert list will show Memberships and Paid trials, including Daily Paid, and leave out only the current plan.
3. Check it on a guest who is on a 3-Day Paid Trial. Open Convert to plan, confirm Daily Paid is listed, and confirm converting to it works.

## Technical details
- `WellnessTrials.tsx` already filters active trial plans with price > 0 and excludes only `t.plan_id`.
- Apply the same grouping in the trial convert control in `MemberDetailSheet.tsx`, then publish.
