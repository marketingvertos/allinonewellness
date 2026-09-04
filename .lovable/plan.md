# Automatic WhatsApp message after a check-in is approved

Right now an approved check-in already drops an item into the notification queue (`checkin_approved`) and the queue runner goes out every 10 minutes, but there is no message text saved for that event and the runner has no weight figures — so nothing is sent. This adds the message, the weight progress numbers and the servings balance.

## What you get

1. **Message on approval** — the moment the team approves a check-in, the member receives a WhatsApp greeting with:
   - their name and today's date
   - the weight they recorded today and the change since their starting weight
   - servings used today and servings left in their plan
   - plan validity date
2. **Two more automatic reminders** using the same numbers: a low-balance nudge (5 / 3 / 1 servings left) and a plan-expiry reminder — these queues already exist, they just get proper text.
3. **Editable text** on the Notifications page, plus the approved template name and its variable order so the same message can go out as a Meta-approved template once WhatsApp approves it.
4. **Manual "Run now"** on the Notifications page stays, so you can push the queue without waiting for the 10-minute cycle.

## Template to submit for approval

Name: `checkin_confirmation` — Category: **Utility** — Language: English

```text
Hi {{1}}, your attendance at All In One Wellness on {{2}} is confirmed.
Today's weight: {{3}} kg ({{4}} since you started).
Servings used today: 1. Servings left: {{5}}.
Plan valid till: {{6}}.
Keep going — see you at your next session!
```

Sample values for the approval form: `Pawan` | `04 Sep 2026` | `75.6` | `-7.1 kg` | `18` | `26 Oct 2026`

Second template, `serving_balance_alert` — Utility:

```text
Hi {{1}}, you have only {{2}} servings left in your plan (valid till {{3}}).
Please contact your coach to renew and keep your progress going.
```

Sample: `Pawan` | `3` | `26 Oct 2026`

Note: for members who messaged you in the last 24 hours the plain text goes out directly; outside that window WhatsApp requires the approved template, which is why both are registered.

## Technical details

- Add rows to `wellness_notification_templates` for `checkin_approved`, `serving_balance` (generic fallback already handled by the runner) and `renewal_due`, each with `message_template`, `template_name`, `template_language` = `en`, and an ordered `variables` array matching the placeholders above.
- Extend the runner (`supabase/functions/whatsapp-notification-runner/index.ts`) variable map with: `weight` (latest approved check-in weight), `weight_change` (latest minus starting weight, signed, 1 decimal), `start_weight`, `remaining`, `used_today`, `end_date` formatted as `dd MMM yyyy` IST, and `date` (already present). Weight comes from the member's weight/measurement history; servings from the active membership row already loaded.
- Format dates in IST before substitution so the message never shows a raw ISO date.
- `queue_checkin_approved_notification` already fires on approval; no trigger change needed. Add a queue insert for `renewal_due` from the existing expiry check if not already present.
- Deploy the runner and verify with one approval end to end: queue row → runner → message log shows `sent` with a provider message ID → status advances to delivered/read via the webhook.

## What you need to do

Submit the two templates above in your WhatsApp panel for Meta approval, then paste the approved names into the Notifications page if they differ.
