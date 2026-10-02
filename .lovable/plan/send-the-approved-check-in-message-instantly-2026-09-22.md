# Send the approved check-in message instantly

`checkin_approved_v2` is approved at Meta, and the stored wording and its eight values already match it. Two things stop members receiving it today.

## What I found

- Automatic WhatsApp sending is switched **off** in settings, so nothing in the queue goes out. 358 messages are sitting unsent, the oldest from 17 Sep. (Start send message from tomorrow  skip the queue of old messages)  from tomorrow ... start sending 
- Even when switched on, the queue is only drained every 10 minutes, so a member could wait up to 10 minutes after their attendance is marked.
- Attendance itself is wired correctly: every check-in (QR approval, front-desk entry, barcode) already queues one check-in message per member per day.

## What will be done

1. Turn automatic WhatsApp sending on.
2. Clear the old backlog: everything queued before today is marked as skipped so switching automation on does not blast days-old messages at members. Today's pending ones stay and go out.
3. Send immediately: as soon as a check-in is approved or recorded in the app, the app triggers the sender straight away, so the member gets the WhatsApp within seconds. The 10-minute schedule stays as a safety net for anything missed.
4. Test end to end with one real check-in and confirm the message arrives with the right name, date, weight, change since start, change from last reading, servings left and plan end date.

## Technical notes

- `integration_credentials.whatsapp_automation_enabled` -> `true`.
- Backlog: `update wellness_notification_log set status='failed', error_message='Cleared backlog' where status='queued' and created_at < today (IST)` — data change via query tool, not a migration.
- `src/hooks/useWellness.ts`: after `useCheckInWithWeight` and `useApproveCheckInRequest` succeed, fire `supabase.functions.invoke("whatsapp-notification-runner", { body: { source: "checkin" } })` in a non-blocking `void` call so check-in never fails if WhatsApp is down.
- Runner already prefers the Meta template when `template_name` is set and guards blank parameters; `checkin_approved` row carries `template_name = checkin_approved_v2` with the correct eight variables in order.
- No UI or schema changes.