# Add "Weight at joining" to the member profile edit form

## Why
The profile edit form currently only lets staff set current weight and target weight. The joining weight (weight when the member joined the club) can only be set when the member is first created, so it cannot be corrected later. Since all progress reporting compares joining weight against current weight, a missing or wrong joining weight breaks the overall gain/loss picture.

## What changes
- In the member profile edit form, add a **Weight at joining the club (kg)** field, shown just before Current weight.
- It is pre-filled with the stored joining weight and can be edited or cleared by admins and managers.
- Helper text under the field: "Weight recorded when the member joined. Used for total gain/loss reporting."
- Saving updates the member's joining weight; current weight and target weight behave exactly as today.
- No other screen changes: the member app, dashboards, achievements, milestones, the members export and the display screens already read this same joining weight, so corrections flow through automatically.

## Technical notes
- `EditMemberDialog.tsx`: add `initial_weight` to the form state, reset block, the save payload (`Number(...)` or `null`), and the weights row in the layout.
- No database change — `wellness_members.initial_weight` already exists and is what `CreateMemberDialog`, `PortalHome`, `MemberDashboard`, `AchievementsPanel`, `WellnessMembers` export and the weight-change display all use.
- Editing joining weight does not touch `weight_tracking` history or recorded check-in weights.
