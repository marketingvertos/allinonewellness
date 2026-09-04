# Check-in confirmation message: end-to-end check and remaining gaps

## What I verified (working today)

- Approving a QR request does queue a message automatically — the database trigger on the check-in requests table fires on approval.
- The confirmation text is saved and active, with the approved template name `checkin_confirmation` (English) and its six values in the right order: name, date, weight, weight change, servings left, plan end date.
- The sender runs on a schedule every 10 minutes and the account details (WachatSender panel, vendor ID, token, automation switch on) are all present.
- The most recent approval on 4 Sep was actually delivered: queue entry created 09:55, marked sent 09:56.

So the automatic flow is live. Three gaps remain.

## Gaps to fix

1. **Up to 10 minutes late.** The member can walk out before the message arrives. Fix: the moment staff press Approve, the app triggers the sender immediately; the 10-minute cycle stays as a safety net for anything missed.
2. **Front-desk check-ins send nothing.** When staff check a member in directly from the Check-in page (no QR request), no message is queued at all — only QR approvals notify. Fix: queue the same confirmation whenever attendance is recorded, whatever the method.
3. **Weight shown can be stale.** The message picks the most recent weight ever submitted through a QR request. For a front-desk check-in, or when the approver corrects the value, that may not be today's number. Fix: read today's recorded weight for that member first, then fall back to the profile weight.

Also: one duplicate guard so a member never gets two confirmations for the same day, even if both the trigger and the immediate run happen together.

## Verify after the change

- Member scans, submits weight, staff approves → message on the phone within seconds, log shows sent with a provider message ID.
- Staff checks a member in directly → same message goes out.
- Same member approved twice in a day → only one message.

## Technical details

- Migration: move the queue insert to an `AFTER INSERT` trigger on `wellness_attendance` (covers `qr_scan`, `staff_entry`, `admin_manual`), replacing the request-status trigger; guard with a `NOT EXISTS` check for a `checkin_approved` row for the same member created today.
- `useApproveCheckIn` and `useCheckInWithWeight` in `src/hooks/useWellness.ts`: after a successful RPC, fire-and-forget `supabase.functions.invoke("whatsapp-notification-runner")`; failures stay silent since cron retries.
- `supabase/functions/whatsapp-notification-runner/index.ts`: build the `weight` variable from today's `weight_tracking` row for the member (latest by `created_at`), then the approved check-in request weight, then `current_weight`.
- Keep the existing cron job, template rows and retry limits unchanged.
