# Evening renewal reminders and reactivation messages

## 1. Send renewal reminders only between 8:00 and 8:30 pm (India time)
- Servings-left reminders (7, 5, 3, 2, 1, 0), the "renewal window closing" reminder and the reactivation reminders stay in the queue during the day. They go out together at 8:30 pm.
- Check-in confirmations, payment receipts, pack notices and birthday wishes keep going out straight away, as they do now.
- If anything is still waiting at 8:30 pm (for example while Meta reviews a template), it goes out the next evening.

## 2. Renewal due message when servings reach 0
Sent the evening a member's servings reach 0. It tells them the 10-day renewal window is open.

**Template:** `renewal_due_zero_servings` (Utility, English)
```text
Hi {{1}}, you have used all the servings in your membership {{2}} at All In One Wellness. Your renewal window is now open for {{3}} days. Please renew before the window closes so your progress, bonus servings and member benefits continue without any break. You can renew at the club front desk or online from your member app.

Shri Chatap
```
Sample values: Pawan / UMS 30 / 10. Includes the "Renew now" button that opens the member login page.

## 3. Reactivation reminders for expired members
Sent to members whose membership has expired and who haven't renewed. Each one goes once, in the evening:
- on the day the membership expires
- 7 days after it expires
- 15 days after it expires
- 30 days after it expires

They stop as soon as the member renews or starts a new plan.

**Template:** `membership_reactivation_reminder` (Utility, English)
```text
Hi {{1}}, your membership {{2}} at All In One Wellness expired on {{3}}. We miss seeing you at the club! Reactivate your services today to restart your servings and continue your wellness journey with your coach. You can renew at the club front desk or online from your member app.

Shri Chatap
```
Sample values: Pawan / UMS 30 / 05 Oct 2026. Includes the "Renew now" button.

Both templates are sent to Meta for approval right away. Messages wait in the queue until each one is approved.

## Technical details
- Runner: add an `EVENING_TRIGGERS` set (`serving_balance*`, `renewal_reminder`, `membership_expired`, `membership_reactivation_*`). Outside 20:00–20:30 IST, the queue query excludes those trigger keys. The existing 10-minute schedule gives three passes (20:00, 20:10, 20:20). Inside the window, raise the batch size to 100 so large evenings clear.
- New vars: `last_plan_name`, `expired_on`. These come from the member's latest expired membership, because the runner currently loads only active memberships. Also add `renewal_window_days` = "10".
- Repoint `serving_balance_0` to `renewal_due_zero_servings` [name, plan_name, renewal_window_days]. Add template rows `membership_reactivation_0/7/15/30` → `membership_reactivation_reminder` [name, last_plan_name, expired_on].
- Migration: a new `queue_reactivation_reminders()` runs daily from the existing 09:00 IST jobs. It finds members whose latest membership has status `expired`, with no queued, active or expiring_soon membership, and an end or expiry date exactly 0, 7, 15 or 30 days ago. Dedupe key: `membership_reactivation_<n>:<membership_id>`. The old one-off `membership_expired` queueing is disabled so members don't get two messages.
- Submit both templates through `whatsapp-templates`, then redeploy the runner.
