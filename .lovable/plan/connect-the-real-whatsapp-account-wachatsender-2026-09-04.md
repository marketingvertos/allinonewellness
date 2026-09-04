# Connect the real WhatsApp account (WachatSender)

Your credentials are for **WachatSender**, not Meta Cloud API. That is why the test kept complaining about the address: the provider was set to Meta while the address belonged to WachatSender. The fix is to store the account as WachatSender with your own panel address.

## What will be set

- Provider: WachatSender
- API base address: `https://console.wachatsender.in/api`
- Vendor UID: `5ebd75fe-df56-4879-9922-60558e0a4116`
- Access token: your token (stored privately, shown masked)
- Phone number ID `1214750505052205` and business ID kept for reference
- Display number +91 70893 43131 (Pawan Tripathi)

## Fixes needed so this sticks

1. **Stop overwriting a custom panel address.** Right now, choosing WachatSender replaces any address with the built-in default `panel.wachatsender.com/api/v1`. It will instead keep a valid WachatSender address like yours and only replace one that belongs to the other provider.
2. **Same on the "fix automatically" button** — it will keep your custom panel address instead of resetting it.
3. **Backend safety net** — a stored WachatSender address is left untouched; only a clearly wrong (Meta) address falls back to the default.
4. **Webhook address.** The webhook currently registered in your panel points at a different project. The correct address for this app will be shown in Settings with a copy button, and you will need to paste it into the WachatSender panel so delivery/read receipts and incoming replies reach this app.

## Verify end to end

- Send a test message from Settings; result card shows success plus provider message ID.
- The test appears in Message logs and the Inbox thread with a status chip.
- After the webhook is repointed, the status advances sent → delivered → read.

## Technical details

- Files: `src/components/settings/WhatsAppSettings.tsx` (provider switch + fix button keep any `wachatsender` host), `supabase/functions/_shared/whatsapp.ts` (URL safety net keeps custom WachatSender hosts).
- Credentials written to `integration_credentials` (`whatsapp_provider`, `whatsapp_api_url`, `whatsapp_api_key`, `whatsapp_vendor_uid`, `whatsapp_phone_number_id`).
- Send endpoint becomes `{base}/{vendor_uid}/contact/send-message?token=...`, matching your example URL — already how the code builds WachatSender requests.

## One note on security

You pasted the access token in chat. After testing, consider rotating it in the WachatSender panel and saving the new one in Settings.
