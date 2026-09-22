# Manage WhatsApp templates from the dashboard

Build a full template manager inside the app: see every template with its Meta status, write new ones, send them to Meta for approval, delete old ones, and pick an approved template for each automatic message.

## What you get

1. **New page: WhatsApp → Templates**
   - Live list of every template in your WhatsApp Business account with name, language, category, status (Approved / Pending / Rejected / Paused), the message body, and the rejection reason when Meta refuses one.
   - Search and filter by status. Refresh button pulls the latest from Meta.
   - Delete a template (with a confirmation warning that it is removed from the WhatsApp account itself, not just this app).

2. **Create a template and submit it to Meta**
   A form with:
   - Name (lowercase letters, numbers and underscores — the app corrects it as you type), language, category (Utility / Marketing / Authentication).
   - Optional header text, body, optional footer, optional buttons (quick reply / visit website / call).
   - Variables written as `{{1}}`, `{{2}}`; for each one you add a sample value, which Meta requires. The form shows a live WhatsApp-style preview with your samples filled in.
   - Built-in checks before submitting: every variable has a sample, the body is long enough relative to its variable count, no variable sits at the very start or end — the three things Meta rejects most often.
   - On submit, the template goes straight to Meta and appears in the list as Pending. Approval usually takes minutes to a few hours; the list shows the current status each time you refresh.
   - Meta does not allow editing a submitted template. The list offers **Duplicate**, which opens the form pre-filled so you can submit a corrected version under a new name.

3. **Wire templates to automations**
   On the existing Notifications page, each automatic message (check-in approved, low balance, renewal due, birthday, anniversary, membership activated, renewed) gets a template picker that lists only **approved** templates from Meta, shows the body, and lets you map each `{{1}}`, `{{2}}` to a member field — name, servings left, plan name, expiry date, weight, centre name — with a preview using a real member. Free text stays available for the 24-hour window.

## Technical notes

- Extend `whatsapp-templates` edge function to a staff-only CRUD surface over the Meta Graph API for the connected WhatsApp Business Account: `list` (all statuses, with `rejected_reason`), `create` (`POST /{WABA_ID}/message_templates`), `delete` (`DELETE …?name=`). Access token stays server-side; Meta's status and error body are surfaced verbatim to the UI.
- New page `src/pages/WhatsAppTemplates.tsx` + route and sidebar entry under the existing WhatsApp group, gated to admin/manager.
- Hooks in `src/hooks/useWhatsApp.ts`: `useAllWhatsAppTemplates`, `useCreateWhatsAppTemplate`, `useDeleteWhatsAppTemplate`; existing `useWhatsAppTemplates` (approved only, used by the inbox picker) keeps working unchanged.
- Automation mapping stores `template_name`, `template_language` and a `variables` array (already columns on `wellness_notification_templates`); the notification runner resolves each mapped field at send time and falls back to free text when no template is set.
- No database changes required.

## Note on approval

Templates are approved by Meta, not by the app — the dashboard submits and tracks them. Marketing templates are reviewed more strictly than utility ones; automatic member notifications should be created as **Utility**.
