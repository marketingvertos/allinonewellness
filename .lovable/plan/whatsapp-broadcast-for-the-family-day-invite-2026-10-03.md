# WhatsApp Broadcast for the Family Day invite

A new **WhatsApp → Broadcast** page where admin/manager pick an approved template, choose who gets it, preview, and send to everyone with live progress.

## What you get

1. **Pick a template** — only Meta-approved templates are listed. While `family_day_garba_celebration` is still Pending it shows with a "Waiting for Meta approval" note and Send stays disabled; once approved it becomes selectable.
2. **Fill the variables** — `{{1}}` defaults to the member's first name ("नमस्कार राहुल जी"). Any other variable can be mapped to a member field or a fixed text.
3. **Choose recipients** with filters:
   - All active members / Expired members / Trial guests
   - Physical or Virtual
   - Optional tag filter
   - Search and untick individual people
   Numbers that are missing or invalid are shown as skipped. Duplicates are removed.
4. **Preview** — the message as one real member will see it, plus the recipient count.
5. **Send test to me** — sends it to one number first.
6. **Send broadcast** — confirm dialog, then sends in small batches with a live bar: Sent / Failed / Skipped. Safe to leave the page: sending continues on the server, and reopening shows progress.
7. **History** — past broadcasts with date, template, counts, and a list of failed numbers with Meta's reason and a "Retry failed" button. Every message also appears in Message Logs with delivered/read ticks.

## Technical notes

- New tables `whatsapp_broadcasts` (template, language, variable mapping, filters, counts, status, created_by) and `whatsapp_broadcast_recipients` (member_id, phone, status, wa message id, error) with GRANTs and staff-only RLS (admin/manager).
- New edge function `whatsapp-broadcast`: `create` resolves recipients server-side from the filters, inserts rows, then processes in batches (~20 per call, short delay) via the existing Cloud API sender path so each send writes `whatsapp_messages`; `process` continues pending rows (called again by the page and by the existing notification runner cron so it finishes if the page closes); `retry_failed`.
- Webhook status updates already update `whatsapp_messages`; recipient rows link by wa message id for delivered/read counts.
- New page `src/pages/WhatsAppBroadcast.tsx`, route `/whatsapp/broadcast`, sidebar entry under WhatsApp; hooks added to `useWhatsApp.ts` reusing `useAllWhatsAppTemplates`.
- Marketing templates can be limited by Meta per user; those failures are shown with Meta's own message.
