# Two-way WhatsApp inbox

Upgrade the existing WhatsApp Inbox into a live two-way chat desk, reusing the webhook, sender and tables already working. Nothing existing is replaced.

## What you get

1. **Reply box that behaves like a chat app**
   - Enter sends, Shift+Enter adds a new line, send button with a spinner.
   - Your message appears instantly marked "Sending", then turns Sent, Delivered, Read on its own as WhatsApp reports back.
   - If it fails, the bubble shows "Message failed" with the reason and a Retry action that never duplicates the message.

2. **Live updates, no refresh, no polling**
   - New replies land in the open chat immediately, the conversation jumps to the top, unread count and last-message line update by themselves.
   - Delivery and read ticks update in place. The current 20/30-second refresh timers are removed.

3. **Better conversation list**
   - Name, mobile, last message, time, unread badge and member status on each row.
   - Search plus filters: All, Unread, Archived. Archive/unarchive from the row.

4. **Conversation view**
   - Date separators (Today, Yesterday, 22 September 2026), incoming left / outgoing right, timestamps and delivery ticks.

5. **Member panel beside the chat**
   - Name, mobile, member status (lead / trial / active / renewal due / expired), current plan with servings left, batch, goal, joining date, last contact, and a link to the full profile. Read-only, with the profile sheet one click away.

6. **Templates from your own WhatsApp account**
   - A Templates button lists your Meta-approved templates, pulled live from Meta (no invented data).
   - Fill in the variables, see a preview of the exact message, then send. Use this when the member's 24-hour reply window has closed.

## Technical notes

- **Reused as-is:** `whatsapp-send` edge function, `_shared/whatsapp.ts`, `_shared/whatsappService.ts` (`sendWhatsApp`, `resolveConversation`, `touchConversation`, `applyMessageStatus`), `whatsapp-webhook`, and the tables `whatsapp_messages`, `whatsapp_conversations`, `whatsapp_api_logs`, `whatsapp_webhook_logs`. No new message table — the existing columns already cover id / provider_message_id / conversation / phone / direction / type / content / status / timestamps / error.
- **Database migration (additive only):**
  - `whatsapp_conversations.archived_at timestamptz null` for the Archived filter.
  - Partial unique index on `whatsapp_messages (provider_message_id)` where it is not null, making webhook replays truly idempotent (today the code catches `23505` but no such constraint exists, so dedup relies on a pre-read only).
  - Add `whatsapp_messages` and `whatsapp_conversations` to the `supabase_realtime` publication with `REPLICA IDENTITY FULL` — realtime currently carries only `wellness_checkin_requests`.
- **Webhook:** keep both provider paths; Meta status handling already maps sent/delivered/read/failed via `applyMessageStatus`. Add storing Meta's error code + message text on failures, and handle the insert-conflict path against the new unique index.
- **Sending:** frontend keeps calling `supabase.functions.invoke("whatsapp-send")`; the token stays server-side. Add `template_variables` passthrough for template sends (already supported by the function signature).
- **Templates:** new edge function `whatsapp-templates` (staff-only, service-side) doing `GET /{WABA_ID}/message_templates` on Graph v25.0 with `META_ACCESS_TOKEN`, returning name, language, status APPROVED only, and parsed body variable count for the preview.
- **Frontend:** `src/hooks/useWhatsApp.ts` gains realtime subscriptions inside `useEffect` (channel removed on unmount) plus optimistic outbound insert into the thread cache; `src/pages/WhatsAppInbox.tsx` gains the filter bar, date separators, status ticks, retry, member panel and template picker. Existing logs pages and settings are untouched.

## Testing

Send from the inbox to a real number, reply from that phone, and watch status move Sending → Sent → Delivered → Read, the conversation jump to the top, and a repeated webhook produce only one message.
