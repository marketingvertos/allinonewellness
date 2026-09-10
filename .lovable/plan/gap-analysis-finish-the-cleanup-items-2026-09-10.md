# Gap analysis: finish the cleanup items

Most of this document is already live. The coach title rules (active frontline only, reversible titles,
own-membership check, monthly quota, at-risk dashboard card, portal display) were built and are working.
What remains is the code-quality section.

## What's already done

- Coach monthly activity tracking, reversible referral titles and the monthly check in the database
- Active frontline vs total referred counts, monthly activity block and membership warning on the
  achievements panel (used by both staff profiles and the member app)
- "Coaches at risk this month" card on the dashboard
- Updated wording on the achievement settings page

## What this change does

1. Tighten the member data type so fields the database always fills (guest flag, mode, tags, pink card
   balance, network counts, master level) are no longer treated as possibly missing, and drop the now
   pointless fallbacks where that reads badly.
2. Remove a leftover type workaround on the member profile sheet when reading the linked login account.
3. Delete two unused files: the old edit-member dialog and the old standalone QR page (both replaced by
   the profile sheet and the check-in page).
4. Keep a single age-from-birthday helper — the one that uses India time — and point the body evaluation
   screens at it, removing the duplicate that used the browser's local time.

## Technical notes

- `src/hooks/useWellness.ts`: make `is_guest`, `member_mode`, `tags`, `pink_card_balance`,
  `frontline_count`, `cluster_count`, `network_total`, `master_level` required.
- `src/components/wellness/MemberDetailSheet.tsx`: use `member.user_id` directly.
- Delete `src/components/wellness/EditMemberDialog.tsx` and `src/pages/WellnessQr.tsx` (no imports, no
  routes point at them).
- Remove `ageFromDob` from `bodyEvalConstants.ts`; import it from `@/lib/formatters` in
  `BodyEvalPrintCard.tsx` and `RecordMeasurementDialog.tsx`.
- Verify with a full TypeScript check afterwards.
