# WhatsApp module for the Wellness centre

Port the same WhatsApp integration used in the IIDC IMS panel into this app, and wire the wellness notifications to it so messages go out automatically from the same business number.

## What you get

1. **Settings → WhatsApp Business API** (admin only)
   - Fields: API URL, access token, vendor UID (WachatSender) or phone number ID (Meta Cloud), webhook verify token, app secret, default language.
   - Master switch for automatic sending, plus a "Test connection" button that reports the exact provider response.
   - Paste the same values you use in IMS and this app talks to the same number.

2. **Automatic notifications**
   Wellness events already write into the notification queue. A scheduled runner picks up queued items every few minutes, renders the template, sends it and marks the row sent/failed with the provider error text.
   Triggers wired: membership activated, membership renewed, serving balance 5 / 3 / 1, trial ending, check-in approved, renewal due, birthday and anniversary wishes.
   Templates stay editable on the Notifications page; each template can carry an approved WhatsApp template name plus variables, or free text for members inside the 24-hour window.

3. **Inbox and delivery tracking**
   - Webhook endpoint for delivery/read receipts and inbound replies, with signature verification.
   - Conversations list with member linking by mobile number, thread view, and reply box.
   - Message log, API activity log and webhook log screens for troubleshooting, mirroring the IMS layout.
   - Manual "Send now" / "Retry" on any queued or failed message.

4. **Member-side sending points**
   Send WhatsApp directly from a member profile (welcome, renewal reminder, custom message) instead of the current wa.me hand-off. The existing wa.me buttons stay as a fallback when the API is not configured.

## Technical notes

- Reuse the IMS code: `_shared/whatsapp.ts` (config loader, E.164, provider request builders for WachatSender and Meta Cloud, response parser) and `_shared/whatsappService.ts` (central send, conversation resolution, message + API logging, status upgrades), adapted from leads/students to wellness members.
- New tables: `integration_credentials` (admin-only key/value), `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_api_logs`, `whatsapp_webhook_logs` — each with GRANTs and RLS restricted to staff/manager roles; the webhook writes with the service role.
- Extend `wellness_notification_templates` with `template_name`, `template_language`, `variables` and keep `message_template` for free text. Extend `wellness_notification_log` with `whatsapp_message_id` and attempt count.
- New edge functions: `whatsapp-send` (staff-triggered), `whatsapp-webhook` (public, verify_jwt false), `whatsapp-test-connection`, `whatsapp-notification-runner` (cron, drains the queue, respects the automation switch).
- Queue triggers: add notification rows for check-in approval, renewal due and celebrations alongside the existing membership/serving triggers.
- New routes under `/whatsapp`: Inbox, Message logs, API logs, Webhook logs; settings card on the existing settings surface. Sidebar entries gated to admin/manager.
- Credentials never appear in client code; the frontend only reads a "configured / not configured" flag.

## What you will need to do once

Paste the IMS WhatsApp values into the new settings screen, then set the webhook URL shown there in your provider panel so delivery receipts and replies flow back.
