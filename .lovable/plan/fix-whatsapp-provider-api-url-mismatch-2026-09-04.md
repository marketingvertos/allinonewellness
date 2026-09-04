# Fix: WhatsApp provider / API URL mismatch

## Problem

The saved base URL is `https://console.wachatsender.in/api` (a custom WachatSender URL). When the provider is switched to "Meta Cloud API", the settings form only swaps the URL automatically if it exactly matches one of the two built-in defaults. A custom URL stays, so the backend validation rejects every test with:

> The API base URL points at WachatSender but the provider is set to Meta Cloud API

## Fix

1. **Settings form — auto-correct on provider switch**
   - When switching provider, reset the base URL if it is empty, one of the two defaults, OR clearly belongs to the other provider (contains `wachatsender` when switching to Meta, or `graph.facebook.com` when switching to Wachat).
   - Show the corrected URL in the field before saving so it is visible, not silent.

2. **Test-result card — one-click repair**
   - When the test connection response includes the provider/URL mismatch error, show a "Fix automatically" button in the result card that sets the correct default URL for the chosen provider and saves it in one tap.

3. **Backend safety net** (`whatsapp.ts` `loadWhatsAppConfig`)
   - When an explicit provider is stored AND the stored URL clearly belongs to the other provider, fall back to that provider's default URL instead of the mismatched URL. This protects all send paths (test, notification runner, inbox replies) even if an old bad value is still in the database.

4. **Verify end to end**
   - Test connection with Meta selected returns success (or a real Meta API error like invalid token, which proves routing is fixed).
   - Test send is recorded in WhatsApp Logs with a delivery status.
   - Switching provider both ways no longer leaves a mismatched URL.

## Technical details

- Files: `src/components/settings/WhatsAppSettings.tsx`, `supabase/functions/_shared/whatsapp.ts`
- Defaults: Meta `https://graph.facebook.com/v21.0`, Wachat `https://panel.wachatsender.com/api/v1`
- Note: the currently stored access token looks like a short Wachat key. After the URL fix, a genuine Meta Cloud API token (from the Meta app dashboard) may be needed for the test to fully succeed — that would surface as a clear "invalid token" message from Meta, not a routing error.
