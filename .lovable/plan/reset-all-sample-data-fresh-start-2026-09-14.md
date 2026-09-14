# Reset all sample data — fresh start

Clear every test record so the centre starts empty and you can feed in real data.

## What gets removed

**All member records (26 people)** — including Pawan, Shri, Sapna, Shahid, Saumya, Saharsh, Kritika, Shubham, Arti and the 15 sample people. Along with each member goes:

- memberships and renewals (33), serving history, pink card history
- visits / check-ins (108) and pending check-in requests
- weight records (111) and body evaluations
- trials (7), notes, achievements, referral links and network counts
- event participation, monthly rewards, WLP session marks
- WhatsApp conversations, messages and notification history tied to them
- the portal logins created for those members

**Old sales-CRM sample** — 10 companies, 15 contacts, 20 deals, 15 tasks, 25 activities, 2 email templates, 22 notifications and the sample sales pipeline.

**Sample batches** — Morning Batch and Evening Batch.

**Try demo button** — removed from the login page, so sample people can never be re-created.

## What stays untouched

- All 7 plans, including the two inactive sample ones (Monthly, Transform — 90 Servings)
- Member categories and tags
- Achievement / milestone definitions
- WhatsApp connection settings and message templates
- Centre check-in code and settings
- Your own admin login and the team accounts

## After the reset

The dashboard, members list, check-ins, trials, achievements and reports will all show zero. Add your first real member and everything builds up from there.

## Technical notes

- One data-only cleanup run, deleting children before parents: `serving_transactions`, `pink_card_ledger`, `wellness_attendance`, `wellness_checkin_requests`, `weight_tracking`, `body_measurements`, `member_notes`, `member_achievements`, `wellness_trials`, `wellness_memberships`, `wellness_event_participants`, `wellness_monthly_rewards`, `wellness_wlp_attendance`, `wellness_notification_log`, `coach_monthly_activity`, `whatsapp_messages`, `whatsapp_conversations`, then `wellness_members` (self-referencing `referred_by_member_id` nulled first), then `wellness_batches`.
- CRM side: `activities`, `tasks`, `deals`, `contacts`, `companies`, `email_templates`, `notifications`, `pipeline_stages`, `pipelines`.
- `wellness_events` rows are kept only if they have no participants; otherwise cleared with their participants.
- Auth users linked via `wellness_members.user_id` are deleted through the admin API so the mobile-number logins are freed for re-registration; the admin/staff accounts in `user_roles` are preserved.
- Frontend: remove the demo-login button and its handler from `src/pages/Auth.tsx`; delete the `demo-login` edge function and its `supabase/config.toml` entry.
