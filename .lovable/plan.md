# Wellness Updates V2 — finish the last four gaps

An end-to-end check against the approved plan shows almost everything is in place: joining date, muscle-mass ranges, install button on the login page, reversible weight milestones, member weight chart and self weigh-in, payment fields, early-renewal bonus servings, and the five-tab Reports section. Four items are still incomplete.

## 1. Payment mode and date when a membership is first sold

Right now the payment method can only be chosen on a renewal. Activating a new membership (or converting a trial) silently records it as Cash paid today, so the Revenue report splits new sales wrongly.

Add a payment method dropdown (Cash / UPI / Card / Online / Other), a payment date (defaults to today) and the amount collected to the "Activate membership" / "Convert trial to membership" step in the member profile, and to the same step on the Trials page.

## 2. Early renewal bonus message never arrives

The congratulations message is queued correctly, but its wording uses a placeholder the sender does not fill in, so it would go out blank. Rewrite the message to use the fields the sender actually provides — member name, bonus servings, servings left and plan end date — so it reads properly.

## 3. MIW Challenge ranking

The participant list shows start and current weight but no ranking. Sort participants by best result and show position numbers, with the leader highlighted; the export follows the same order.

## 4. Family Day card for members

The member's Family Day card shows attendance days only. Add whether they hold a milestone (and which one) and, for members tagged as coaches, how many WLP sessions they attended this month — alongside the existing attendance line and the reminder that awards are handed out at the ceremony.

## Technical notes

- `MemberDetailSheet.tsx` and `WellnessTrials.tsx`: payment mode/date/price state passed into the existing `useCreateMembership` mutation (the hook already writes `payment_mode` / `payment_date`).
- `wellness_notification_templates` data update for `trigger_key = 'early_renewal_bonus'`: replace `{{member_name}}` with `{{name}}` and add `{{remaining}}` / `{{end_date}}`, updating the `variables` array to match what `whatsapp-notification-runner` builds. Data change only, no migration.
- `WellnessReports.tsx` MIW tab: derive `change = end_weight - start_weight`, sort ascending for loss goals, add a rank column and reuse the sorted rows for the CSV.
- `PortalHome.tsx`: reuse `useUnlockedAchievements` for the milestone line and `useWlpAttendance(currentMonthIst())` filtered to the signed-in member for the coach session count.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`.
