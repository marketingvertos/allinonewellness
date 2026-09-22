# New check-in confirmation message

Replace the wording sent after a check-in is approved with your version, including the two new lines about the change since the last reading.

## Final message

```text
Hi {{1}}, your attendance at All In One Wellness on {{2}} is confirmed.

Today's weight: {{3}} kg ({{4}} since you started).

Change from last reading: {{5}} (last: {{6}} kg).

Servings used today: 1. Servings left: {{7}}.

Plan valid till: {{8}}.

Keep going — see you at your next session!

Team All In One Wellness
```

Filled in automatically as: first name, today's date, today's weight, total change since joining, change versus the previous reading, previous weight, servings left, plan end date.

## What will be done

1. Update the stored check-in message to the new wording and the eight values above.
2. Submit it to Meta for approval under a new name (`checkin_approved_v2`) — the old `checkin_approved` name already holds the previous wording at Meta and cannot be edited in place. Once approved, check-in messages start using it; the old one is left unused.
3. Guard against blanks: if a member has no earlier reading, "Change from last reading" shows `N/A` and the previous weight shows `—`, so Meta never receives an empty value (which would make the send fail). Same guard for weight, servings and plan date.

## Technical notes

- Migration: update `wellness_notification_templates` row `checkin_approved` — new `message_template`, `variables` = `[name, date, weight, weight_change, daily_change, last_weight, remaining, end_date]`, `template_name` = `checkin_approved_v2`.
- `supabase/functions/whatsapp-notification-runner/index.ts`: `daily_change` and `last_weight` already computed from the two most recent `weight_tracking` rows; add non-empty fallbacks before building `templateVars`.
- Submit the new template through the existing `whatsapp-templates` function (UTILITY, en), then redeploy the runner.
- Approval takes minutes to 48 hours; until then the message goes out as plain text with the same wording.
