# Automatic renewal reminders at 7, 5, 3, 2 and 1 servings left

## What members will get
A WhatsApp renewal reminder is sent on its own when a member's servings drop to:

| Reminder | Servings left |
|---|---|
| 1st | 7 |
| 2nd | 5 |
| 3rd | 3 |
| 4th | 2 |
| 5th | 1 |

- Each reminder goes **once per membership**. A correction (+1 then -1) won't send the same reminder twice.
- It goes out right after the serving is used, whether by QR check-in, front desk, barcode or Pack & Issue.
- If a Pack & Issue skips past a number (for example 8 straight down to 4), only **one** reminder is sent, for the lowest number crossed (here, the "5 left" one). The member doesn't get a pile of messages.
- No reminder goes out if the member has already renewed, meaning a newer membership is queued or active.
- Trials and the 1-day plan are left out.
- Every send shows in the WhatsApp inbox and notification history, like the check-in messages.
- While Meta is still reviewing the template, reminders wait in the queue and go out once it's approved. They are not sent as free text.

## WhatsApp template to submit (Utility category)

**Name:** `renewal_reminder_servings`
**Language:** English (en)
**Category:** UTILITY

**Body:**
```text
Hi {{1}}, this is a reminder from All In One Wellness. Your membership {{2}} now has {{3}} serving(s) remaining. To continue your wellness journey without any break, please renew your membership before your servings run out. You can renew at the club front desk or online from your member app. Thank you for staying consistent with us!
Team All In One Wellness
```

**Sample values:** {{1}} = Pawan, {{2}} = UMS 30, {{3}} = 5

**Footer (optional):** `Reply to this message if you need help renewing.`
**Button (optional):** Visit website, "Renew now", https://club.weightlossmentorshri.com/auth

One template covers all five reminders because only the serving count changes. I can submit it to Meta from the app right after you approve this plan. Approval usually takes a few minutes and can take up to 48 hours.

## Technical details
- Migration: replace `queue_serving_threshold_notification()` so it fires when `remaining_servings` crosses below any of {7,5,3,2,1}. It picks the lowest threshold crossed in that update and skips memberships whose plan isn't the 30-day UMS type or that have a newer queued or active membership. Trigger key is `serving_balance_<n>`. Dedupe uses a unique check on (member, trigger_key, membership id) through a `dedupe_key` in `wellness_notification_log` (new nullable column + partial unique index).
- Runner: `pickTemplate` already maps `serving_balance_<n>` to the generic `serving_balance` template. Map the variables member first name, plan name and remaining servings to positions {{1}}..{{3}}.
- Create the template through the existing `whatsapp-templates` function and link it to the `serving_balance` notification trigger in the settings.
- Redeploy `whatsapp-notification-runner`, then test it on one membership.
