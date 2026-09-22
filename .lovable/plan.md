# Switch WhatsApp to your permanent System User token

The error is a plain expiry: the temporary token you generated earlier lasted 24 hours and ran out at 05:00 PDT today. Everything else in the WhatsApp setup is fine — the phone number, business account, webhook and message flow are unchanged.

## What happens

1. A secure form opens where you paste the permanent System User token. It is stored server-side only, exactly like the old one; it never appears in the app, the address bar, or any log.
2. I run a live check against your WhatsApp number to confirm the new token works and does not expire.
3. I re-run the WhatsApp functions so they pick up the new value, then send one real test message and report the result.

## Notes

No code changes are needed: the sending function, inbox, templates and automatic messages already read the token from the secure store, so swapping the value is enough.

For the token to work permanently, the System User must have the `whatsapp_business_messaging` and `whatsapp_business_management` permissions and be assigned to the WhatsApp Business account, with expiry set to "Never". If the check fails I will tell you exactly which of those is missing.

## Technical details

- Secret name stays `META_ACCESS_TOKEN`, replaced via the secure secret form (no `.env`, no frontend variable).
- Readers: `supabase/functions/_shared/whatsapp.ts` (Meta branch prefers the secret over the stored `whatsapp_api_key`) and `supabase/functions/whatsapp-cloud-send/index.ts`.
- Verification: `GET /v25.0/892351043962383` and a `hello_world` template send; then redeploy `whatsapp-send`, `whatsapp-test-connection`, `whatsapp-templates`, `whatsapp-notification-runner`, `whatsapp-webhook`, `whatsapp-cloud-send` so the new secret is bound.
- The stale `whatsapp_api_key` row stays empty so the expired value can never be used as a fallback.
