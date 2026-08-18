# Wellness / Balance Centre Module

Add the member lifecycle module (Guest → Trial → Membership → Attendance & Servings → Progress → Renewal) into the existing Vertos CRM, without touching any existing table, route or hook.

## Scope decision

Build **Phase 1, 2 and 3 in full** (members, trials, memberships, plans, batches, attendance + check-in, serving ledger, weight/BMI + charts), plus the admin Wellness dashboard.

Deferred, with reasons:
- **Member phone-OTP login and the member PWA (`/portal`)** — this needs an SMS provider (Twilio/MSG91) configured in the backend auth settings, which is a settings decision, not code. Until then staff create and manage member records; check-in is done at the front desk. The schema is built so the portal can be switched on later with no data migration (`wellness_members.user_id` stays nullable, member-scoped RLS policies ship now).
- **Phase 4 WhatsApp/Email automation** — needs a WhatsApp Business vendor. The two notification tables and the balance-threshold trigger that queues events **will** ship, so the log fills up from day one; only the sending edge function waits.

## Changes to the PRD that suit the current architecture

1. **Sidebar** — `mainNav` in `AppSidebar.tsx` is a flat array with no `children` support. Wellness will be added as a **second collapsible sidebar group** ("Wellness") using the shadcn `Collapsible` + `SidebarGroup` primitives already in the project, below the existing sales group. The 12 existing items are untouched.
2. **`handle_new_user()` guard** — applied as specified (branch on `account_type = 'wellness_member'`), so a future member signup never becomes a sales rep. Harmless today, required before the portal ships.
3. **Trial `end_date`** — the PRD's generated column `start_date + duration_days` is kept, but written as `(start_date + duration_days)::date` so the stored type is `date`.
4. **Check-in from the desk** — `checkin_member()` RPC ships exactly as specified (atomic, duplicate-guarded by `UNIQUE(member_id, visit_date)`). The QR flow becomes a staff-side search-and-check-in screen plus a member QR/code field on the profile; the same RPC serves the portal later.
5. **Expiry job** — instead of a scheduled edge function (no cron confirmed), expiry is evaluated by a `refresh_wellness_statuses()` SQL function that is also called on load of the Wellness dashboard, so statuses are correct without a scheduler. It can be attached to cron later unchanged.
6. **`contact_id` link to CRM contacts** — kept and wired: the member form has an optional "Link CRM contact" picker, so a wellness lead can be tied to a sales prospect.

## Data model (one migration, house-rule order)

Enums: `wellness_status`, `trial_status`, `membership_status`, `checkin_method`, `serving_txn_type`, `wellness_goal`.

Tables, each with `CREATE TABLE → GRANT (authenticated + service_role) → ENABLE RLS → POLICIES → updated_at trigger`:
`wellness_plans`, `wellness_batches`, `wellness_members`, `wellness_trials`, `wellness_memberships`, `wellness_attendance`, `serving_transactions`, `weight_tracking`, `body_measurements`, `member_notes`, `wellness_notification_templates`, `wellness_notification_log`.

Columns, constraints and RLS follow Sections 5 and 9 of the PRD verbatim, including:
- one active membership per member (partial unique index),
- one check-in per member per day (unique constraint),
- serving_transactions insert-only (no update/delete policy),
- member_notes never visible to a member,
- member self-update restricted to safe columns by a BEFORE UPDATE trigger.

Functions: `checkin_member()`, `convert_trial_to_membership()`, `renew_membership()`, `refresh_wellness_statuses()`, `queue_serving_threshold_notification()` (AFTER UPDATE trigger on memberships).

## Frontend

Routes inside the existing `AppLayout` block: `/wellness`, `/wellness/members`, `/wellness/members/:id`, `/wellness/trials`, `/wellness/memberships`, `/wellness/attendance`, `/wellness/servings`, `/wellness/progress`, `/wellness/batches`, `/wellness/settings`.

Hooks in `src/hooks` following the `useDeals.ts` shape: `useWellnessMembers`, `useWellnessPlans`, `useBatches`, `useTrials`, `useMemberships`, `useAttendance`, `useCheckIn`, `useServingLedger`, `useProgress`, `useWellnessStats`.

Pages copy the `Contacts.tsx` pattern (PageBanner → create dialog → table/cards → detail Sheet → skeletons → empty state). Member detail is a tabbed sheet: Overview, Membership, Trial, Attendance, Servings, Progress, Notes.

Dashboard cards: total/active members, active trials, trials ending today, conversion rate, today's check-ins, renewals due, serving consumption trend (recharts), weight-progress distribution.

All money through `formatCurrency`/`formatCompactCurrency`, all dates through the IST formatters, all errors through `sanitizeErrorMessage`, semantic tokens only — plus a `--wellness-good / --wellness-warning / --wellness-critical` token trio in `index.css` for balance and BMI badges.

## Demo data

The demo workspace seed (`demo-login`) gains Indian wellness data: 3 plans, 2 batches, ~15 members across lead/trial/active/renewal-due, memberships with partly-consumed servings, 3 weeks of attendance and matching ledger rows, and weight entries — so the module is populated on first look.

## Not included

Member PWA, phone OTP, WhatsApp/Email sending, CSV export for wellness (Phase 5).
