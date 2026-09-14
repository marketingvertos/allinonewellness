# Edit member profile

Today the member panel only lets you change a few things one at a time (date of birth, joining date, batch, tags, referrer). Name, mobile number, email, gender, goal, height, target weight, relationship status and anniversary can't be corrected at all after a member is added.

## What changes

Add an **Edit profile** button at the top of the member panel, next to the member's name. It opens a form with all the profile details in one place:

- Member type (physical / virtual)
- Full name, mobile number, email
- Gender, date of birth
- Joining date
- Relationship status and anniversary (anniversary shown only when married)
- Goal
- Current weight, target weight, height
- Tags, batch, referred by

Save updates everything at once and the panel refreshes immediately; Cancel discards the changes. Same field layout and validation as the "Add member" form, so nothing new to learn.

Only team members (admin, manager, staff) see the button. Changing the mobile number shows a short note that the member's login ID stays as it was until the login is reset.

The existing quick-edit boxes on the Overview tab stay where they are, so current habits keep working.

## Technical notes

- New `EditMemberDialog` in `src/components/wellness/`, reusing the field layout of `CreateMemberDialog` plus `DobInput`, `TagPicker`, `BatchPicker`, `ReferrerPicker`.
- Saves through the existing `useUpdateWellnessMember` hook; `wellness_members` already has a staff UPDATE policy, so no database change is needed.
- Button and dialog wired into `MemberDetailSheet.tsx` header, gated by the existing staff/manager check used in that file.
- `current_weight` edited here updates the member record only; the weight history log is unchanged (that stays in the Progress tab).
