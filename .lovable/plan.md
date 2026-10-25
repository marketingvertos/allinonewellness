# Broadcasts with full delivery tracking and reports

Our broadcasts already save delivery and read receipts from WhatsApp. For example, past broadcasts reached 847 people, 412 messages were delivered and 293 were read. The Broadcast page doesn't show any of this yet, so it only shows Sent, Failed and Skipped. This plan brings in the best parts of your reference WhatsApp tool.

## What you get

**1. Broadcast report page (open any broadcast)**
- A live funnel: Queued → Sent → Delivered → Read → Replied, plus Failed and Skipped. Each step shows a count and a percentage.
- Rates: delivery rate, read rate, reply rate and failure rate.
- A recipient table with name, mobile, status, and sent, delivered and read times. The table has search and status filter chips (All, Delivered, Read, Replied, Failed, Pending) and a link to the member's profile.
- A "Why it failed" summary that groups failures by reason in plain words. Examples: Meta marketing limit, not on WhatsApp, invalid number.
- One-click actions: retry the failed recipients, send again only to people who haven't read it, and download Excel (all recipients or the current filter).
- Updates live while a broadcast is still sending, with no need to refresh.

**2. Better broadcast list**
- Each broadcast shows as a card with its template, date, who sent it, a status badge (sending badges pulse) and a small funnel bar showing sent, delivered, read and failed.
- Search by template name, plus a date-range filter.
- Totals at the top for the chosen period: messages sent, delivered %, read % and replies.

**3. Reliable sending**
- Resume: a broadcast that stopped halfway (page closed, Meta limit, temporary error) can be continued from where it stopped. Nobody gets the message twice.
- Optional scheduled send: pick a date and time, and it starts automatically.
- A clearer 4-step flow, based on the reference tool: Template → Audience → Personalise → Review and send. The review step shows the recipient count and an estimated cost category before sending.

## Technical notes

- `whatsapp_broadcast_recipients`: add `delivered_at`, `read_at`, `replied_at`, `failed_reason_code`, `provider_message_id`. Extend the status set to queued/sent/delivered/read/replied/failed/skipped. Backfill from the linked `whatsapp_messages` rows.
- `whatsapp_broadcasts`: add `delivered_count`, `read_count`, `replied_count`, `scheduled_at`, `started_at`, `completed_at`. A trigger on recipient status changes updates the counts incrementally (the reference tool's pattern). Recompute the counts once in the backfill.
- Webhook: when a status update arrives for a message linked to a broadcast recipient, move that recipient forward only (sent → delivered → read, never backwards). Do the same for an incoming reply within 72 hours of the send. Keep the current idempotence.
- `whatsapp-broadcast` function: add `resume`, `retry_failed` and `resend_unread` actions, all reusing the existing queue. Scheduled broadcasts are picked up by the existing scheduled run.
- Enable realtime on `whatsapp_broadcasts` and `whatsapp_broadcast_recipients` for the live report.
- Frontend: a new `/whatsapp/broadcast/:id` report page; the list and wizard are rebuilt in `WhatsAppBroadcast.tsx`. Shared status/colour config and failure-reason mapping go in `src/lib/broadcastStatus.ts`, with unit tests for funnel percentages, forward-only status rules and failure grouping (adapted from the reference tool's tests).
- Excel export uses the existing export helper.
