# Automatic WhatsApp messages for the whole member journey

Build out the full set of 17 automatic messages, from welcome to expiry, with richer details inside each message (plan name, price, daily weight change, renewal days left, milestone name).

## What you get

**1. Messages for every moment of the journey**

New: welcome, trial started, trial ending tomorrow, check-in not approved, plan switched, login details, weight milestone achieved, birthday wishes, servings packed and issued, payment receipt, all servings used (renewal window started), renewal reminder with days left, membership expired.

Updated wording: membership activated, membership renewed, check-in confirmed, low serving balance.

Each one is pre-filled in the Notifications screen with the exact wording from your document, so you only pick the matching approved template from WhatsApp once it is approved.

**2. New details available inside messages**

Mobile number, plan name, total servings, servings used, amount paid, joining date, activation code, trial end date and days left, renewal days left, milestone name, packed servings and reason, payment mode, and two new weight figures: change since the last reading, and the last recorded weight.

**3. Correct serving-driven lifecycle**

Today a membership can expire on the calendar date even if servings remain. It will instead follow servings only: servings reach 0 → renewal due for 10 days → reminder on day 7 → expired on day 11. The plan end date stays visible in messages as information.

**4. Daily automatic checks**

Birthdays, trials ending tomorrow, renewal reminders and status refresh run every morning at 9:00 India time. Messages already go out every 10 minutes through the existing sender.

## Technical notes

Database migration:
- Rewrite `refresh_wellness_statuses()`: drop the `end_date < today` expiry and the "5 days to end date" rule; keep the existing `servings_exhausted_on` grace (0 servings → `expiring_soon`, +10 days → `expired`), and queue a `membership_expired` notification once per expiry (30-day dedupe).
- Unique index on `wellness_notification_templates (trigger_key, channel)` — none exists today, needed for idempotent seeding and to stop duplicate rows.
- New queue trigger functions + triggers: `member_created` (skip guests), `trial_started`, `milestone_achieved` (weight categories only, on `member_achievements`), `checkin_rejected` (on `wellness_checkin_requests` status → rejected). `switch_membership_plan` gains a `plan_switched` queue insert; `issue_servings` gains `servings_issued`; `record_payment` gains `payment_received`.
- Cron queue functions: `queue_birthday_notifications`, `queue_trial_ending_notifications`, `queue_renewal_reminder_notifications` (day 7 of the window, from `servings_exhausted_on`), each with dedupe windows. `REVOKE ALL` on the new functions from `anon, authenticated`.
- Scheduled jobs at `30 3 * * *` UTC (09:00 IST): status refresh, birthdays, trial ending, renewal reminder — one job per task, once a day, so there is no added recurring database load beyond a single daily wake-up.

Notification runner (`whatsapp-notification-runner`):
- Extend the variable map with `mobile`, `plan_name`, `total_servings`, `used_servings`, `price` (en-IN), `joining_date`, `activation_code`, `daily_change`, `last_weight`, `trial_end_date`, `trial_days_left`, `renewal_days_left`, `milestone`, `issued_servings`, `issue_reason`, `payment_mode`.
- `daily_change` / `last_weight` from the two most recent `weight_tracking` rows per member; plan name via a join on `wellness_plans`; trial, achievement and payment lookups only for the triggers that need them; `renewal_days_left` from `servings_exhausted_on`.
- Batched per-member lookups (no per-item round trips), unchanged retry, dedupe and free-text fallback behaviour.

Seeding (data operation, not a migration): insert the 16 default message bodies with `template_name`, `template_language` and ordered `variables`, skipping any trigger already configured.

UI (`src/pages/WellnessNotifications.tsx`): replace the trigger list with all 19 keys and readable labels; extend the member-field list with the new variables so each `{{1}}`, `{{2}}` can be mapped.

## What you do once

Submit the 17 template bodies to Meta from the existing WhatsApp templates screen (all Utility). When each shows Approved, open the matching automation and pick it — until then those messages stay queued as free text.
