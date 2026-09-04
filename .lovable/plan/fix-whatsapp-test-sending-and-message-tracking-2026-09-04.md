# Fix WhatsApp test sending and message tracking

## What is happening

The test messages are being sent to the wrong provider address, so WhatsApp rejects every one of them. The saved settings currently contain **both** a WachatSender vendor ID and a Meta Cloud phone number ID, with the API address left empty. The app assumes "vendor ID present = WachatSender", so it builds a WachatSender-style address on top of Meta's default server. Meta answers with an error ("Unknown path components: /send-message"), which is recorded in the API log at 09:06, 09:02 and 09:01 today — three failed attempts, no successful send.

On top of that, the test send is not recorded as a message at all: it only writes an API activity row. That is why nothing shows in the message log and why there is no sent / delivered / read status for it.

## What will be fixed

1. **Pick the provider explicitly.** Settings gets a clear provider choice — Meta Cloud API or WachatSender — instead of guessing. Choosing one shows only the fields that provider needs, fills in the correct default API address, and hides the unused field so the two can never be mixed again.
2. **Block a mismatched setup before sending.** If the chosen provider's required details are missing or the address does not match the provider, the screen says exactly what is wrong instead of firing a doomed request.
3. **Always show the result.** The test panel keeps a result card visible after every attempt — success or failure — with the provider, the status code, the message ID and the provider's own error text, plus a plain-language explanation. Errors returned with a non-success status will no longer leave the panel empty.
4. **Log the test as a real message.** Every test send creates a row in the message log (with member linking by number where possible) so it appears in the Inbox thread and the Message logs screen, and its status moves sent → delivered → read as the provider's receipts arrive.
5. **Show delivery state everywhere.** The Message logs and Inbox rows get status chips (queued, sent, delivered, read, failed) with timestamps and the failure reason, and a Retry action for failed sends.
6. **Re-test with the corrected settings** and confirm a real message is delivered and its status updates.

## Technical notes

- `supabase/functions/_shared/whatsapp.ts`: add an explicit `whatsapp_provider` credential (`meta` | `wachat`); `isWachat` reads it and only falls back to the current inference when unset. Per-provider default base URL. Add a `validateConfig(cfg)` returning missing/conflicting fields.
- `supabase/functions/whatsapp-test-connection/index.ts`: run `validateConfig` first and return a structured `not_configured` payload; route the send through `sendWhatsApp` from `_shared/whatsappService.ts` (with `source_module: 'test'`) so it creates conversation + `whatsapp_messages` rows and keeps `logApiCall`; return the message id alongside the provider response, always with HTTP 200 so the client can render the detail.
- `src/hooks/useWhatsApp.ts`: `useTestWhatsAppConnection` parses `FunctionsHttpError` bodies so non-2xx responses still yield a displayable result; invalidate `whatsapp-messages` / `whatsapp-api-logs` on completion.
- `src/components/settings/WhatsAppSettings.tsx`: provider select bound to `whatsapp_provider`, conditional fields, inline validation, persistent result card.
- `src/pages/WhatsAppLogs.tsx` / `WhatsAppInbox.tsx`: status badge with delivered/read timestamps, error reason, Retry for failed rows.
- Webhook status mapping already exists (`applyMessageStatus`); no schema change needed beyond storing the provider key.

## One thing needed from you

Confirm which provider your other panel actually uses — the settings hold credentials for both. Based on the phone number ID and the Graph error, Meta Cloud API looks correct, and I will default the fix to Meta Cloud unless you say otherwise.
