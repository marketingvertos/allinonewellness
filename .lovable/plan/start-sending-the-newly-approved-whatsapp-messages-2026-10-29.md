# Start sending the newly approved WhatsApp messages

## Where things stand (checked live with Meta today)

Already approved AND already sending (no change needed):
member welcome, membership welcome/renewal confirmation, early-renewal bonus, payment receipt, plan switched, check-in approved/rejected, WLP check-in, packed servings issued, birthday, anniversary, weight loss/gain milestones, MIW registration, Pink Card credit, trial welcome / day 1 / ending, serving-balance reminders (7/5/3/2/1 and zero), renewal due, membership expired, reactivation reminders, Yellow Card details.

Approved by Meta but NOT yet sent by the app (these are what this plan connects):
1. `lead_welcome_invite` — when a new lead is added (staff or public form)
2. `family_day_qualified` — when a member reaches the monthly Family Day target (−5 kg loss / +3 kg gain)
3. `consistency_26_days` — when a member completes 26 days of consistency in a month
4. `ambassador_title_achieved` — when a member earns the Ambassador title
5. `member_absent_reminder` — member with an active plan who hasn't visited for 3 days (sent once per absence, evening window)
6. `miw_challenge_starts` — to all registered participants on the challenge start date
7. `miw_midway_update` — on day 11 of the challenge with weight change so far
8. `miw_challenge_completed` — after day 21 with total weight change

Rejected: `login_credentials` (the old activation-code message, no longer used since login needs no code — will be switched off so it stops trying).

The rest of the list (Supervisor title, trial day-2 follow-up, trial completed offer, at-risk title warnings) will be re-checked at the start of building; whichever are approved get connected the same way, and any still pending or rejected are reported back with Meta's reason.

## What will happen
- Each approved message gets its own setting on the Notifications page (on/off, status from Meta).
- Messages go out once per event — no repeats if the same member qualifies again the same day/month.
- Leads receive their welcome even though they are not members yet.
- Every send is logged so you can see sent / delivered / read like other messages.

## Technical details
- Insert rows into `wellness_notification_templates` for each new trigger_key with variables matching the approved template's placeholder count/order (read from Meta components); deactivate `login_credentials`.
- Add enqueue points: leads insert (DB trigger), Family Day/consistency/title award paths (existing staff-notification triggers from migration 0035), MIW date-based jobs and absent check inside `whatsapp-notification-runner` daily pass (IST), with dedupe keys in `wellness_notification_log`.
- Runner: support lead recipients (phone without member_id) and resolve new variables (kg change, month, title, challenge dates).
- Deploy runner; verify with a test send to Pawan's number per new message; update roadmap.md.
