# Relationship details + full admin control over bait (weight) tracking

## 1. Relationship status and anniversary

- Add **Relationship status** (Single / Married / Prefer not to say) to the Add Member and Edit Member forms.
- When "Married" is chosen, an **Anniversary date** field appears (optional).
- Member profile header shows relationship status and anniversary (with years completed).
- The Wellness dashboard card becomes **Upcoming birthdays & anniversaries** (next 30 days): one combined, date-sorted list with a birthday or anniversary tag, "Today"/"in N days" badge, years turning / years completed, and the existing one-tap WhatsApp wish (message text adapts to birthday vs anniversary).

## 2. Admin control of the bait (weight) journey

Today staff can only add a weight reading — nothing can be corrected. Add full correction ability for admins/managers:

**Baseline parameters (Edit member)**
- Starting bait, target bait, current bait and height are all editable in the member edit form (starting/target/height already exist; current bait is added so a mistaken value can be fixed directly).
- A note under the fields explains: current bait is normally updated automatically by the latest recorded reading.

**Daily records (Progress tab)**
- The weight history list becomes an editable log: each row gets **Edit** and **Delete** actions.
- Edit opens a small dialog with date, bait (kg) and note; saving updates that record.
- Delete asks for confirmation before removing the record.
- After any edit/delete the member's current bait is recomputed from the latest remaining reading (or cleared to the starting bait if no readings remain), so the tiles, trend chart, goal progress and badges stay correct.
- Adding a reading also allows choosing the **date** (currently locked to today), so missed days can be backfilled.

**Body measurements (waist / hip / chest / body fat)**
- Same treatment: each recorded measurement set can be edited or deleted from the Progress tab.

**Permissions**
- Edit and delete of records are shown only to admin / manager roles; regular staff keep add-only. Access rules in the database already allow staff to correct records and managers to delete them, so no new access rules are required — only the delete-side achievement refresh below.

## 3. Achievements stay in sync

Milestone badges currently recalculate when a weight record is added or changed, but not when one is deleted. Extend the recalculation so removing a record also re-evaluates the member's bait-loss/bait-gain milestones.

## Technical notes

- Migration: add `marital_status text` and `anniversary_date date` to `wellness_members`; recreate `weight_achievements_sync` as `AFTER INSERT OR UPDATE OR DELETE` with a trigger function that uses `COALESCE(NEW.member_id, OLD.member_id)`.
- New hooks in `useWellness.ts`: `useUpdateWeightEntry`, `useDeleteWeightEntry`, `useUpdateBodyMeasurement`, `useDeleteBodyMeasurement`, plus a shared `syncCurrentWeight(memberId)` helper called after mutations; extend `useUpcomingBirthdays` into `useUpcomingCelebrations` returning birthdays and anniversaries.
- UI: `CreateMemberDialog.tsx` and `EditMemberDialog.tsx` gain the relationship/anniversary/current-bait fields; `MemberDetailSheet.tsx` Progress tab gains the editable log; new `EditWeightEntryDialog.tsx`; `BirthdaysCard.tsx` renamed in content to celebrations; `MemberDashboard.tsx` header shows the anniversary badge.
- Role gating via the existing `useUserRole`/`has_role` pattern used elsewhere in the module.
