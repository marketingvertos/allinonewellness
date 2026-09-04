# Fix member overview updates + reorder Achievements

## 1. "Updated" toast but nothing changes (Referred by / Batch)

The save does reach the database, but the open member panel keeps showing a snapshot of the member taken when the row was clicked. The list refreshes behind the panel; the panel itself never re-reads the member, so batch and referred-by look unchanged until the panel is closed and reopened.

Fix:
- The member panel re-reads the live member record by id and renders that, falling back to the passed-in snapshot while it loads.
- After a successful save, the member-detail query is refreshed too (today only the list queries are), so the batch name and referrer appear immediately.
- The referred-by picker's local draft resets when the panel switches to a different member, so one member's pending selection can't leak into another's.
- Verify in the browser: change batch and referred-by on a member, confirm both values update in place without reopening, and confirm the change persists after a reload.

## 2. Achievements tab order

On the member Achievements tab (staff sheet and member portal), show the weight (bait) journey card first and the Community / referral card second. No content changes, only order.

## Technical notes

- `src/pages/WellnessMembers.tsx` keeps only the selected member id, or `MemberDetailSheet` calls `useWellnessMember(member.id)` and prefers that data — whichever keeps `MemberSheetById` working unchanged.
- `useUpdateWellnessMember` in `src/hooks/useWellness.ts` already invalidates `wellness-members` / `wellness-member`; confirm the detail query key matches and that the select in `useWellnessMember` includes `member_categories` and `referred_by_member_id` so the panel has everything it renders.
- `referrerDraft` in `MemberDetailSheet.tsx` resets on member id change.
- `AchievementsPanel.tsx`: move the health card block above the community card block.
