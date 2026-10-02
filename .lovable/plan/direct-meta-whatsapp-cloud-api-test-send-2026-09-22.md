# Direct Meta WhatsApp Cloud API test send

Goal: one real WhatsApp message travelling from a test page in your app, through a secure backend function, to Meta's Cloud API — with the access token stored only on the server.

## One important naming note

Your app already has a live function called `whatsapp-send`. It powers the member inbox, automatic check-in messages, renewal reminders and the message logs, and it reads its credentials from the Settings screen. Replacing it would break all of that.

So the new, clean Meta-only path gets its own name: **`whatsapp-cloud-send`**. Everything else follows your instructions exactly. The existing WhatsApp features keep working untouched. If you would rather retire the old path later, we can switch the CRM over once this one is proven.

## What gets built

1. **New backend function `whatsapp-cloud-send`**
   - Posts to `https://graph.facebook.com/v25.0/892351043962383/messages`
   - Reads the token from the server-side secret `META_ACCESS_TOKEN` only
   - Accepts `{ "to": "919815064617" }` and sends the `hello_world` template in `en_US`
   - Recipient always comes from the request; nothing is hard-coded in the app
   - Handles the browser's preflight (OPTIONS) request

2. **New page `/whatsapp-test`** (inside the existing admin layout, signed-in staff only)
   - Heading "WhatsApp API Test"
   - Phone number field, pre-filled with 919815064617
   - Message type shown as Template, template shown as hello_world
   - "Send Test WhatsApp Message" button with a loading state
   - Success: confirmation plus the Meta message ID
   - Failure: HTTP status, Meta error message, error code and details, in plain readable form

3. **Error handling** for: missing token, invalid token, wrong phone number ID, invalid recipient, authentication failure, permission error, template error, rate limit, network error and malformed request. Every case returns a structured result; the token never appears in any response or log.

4. **Secret**: you will be asked to paste `META_ACCESS_TOKEN` into the secure form. No frontend variable is created.

Not included, as you asked: incoming webhooks, auto-replies, template management, and no changes to your CRM design.

## Technical details

- `supabase/functions/whatsapp-cloud-send/index.ts`, new folder, no shared-helper reuse so the Meta path stays independent of the WachatSender config loader.
- Constants in the function: `GRAPH_VERSION = v25.0`, `PHONE_NUMBER_ID = 892351043962383`. Token via `Deno.env.get("META_ACCESS_TOKEN")`.
- Requires a signed-in staff user (Bearer token verified, role checked against `user_roles`) so the endpoint cannot be used anonymously.
- Body validated with Zod: `to` must be 10-15 digits, no `+`; optional `template_name` (default `hello_world`) and `language` (default `en_US`).
- Response shape: `{ success: true, message_id }` or `{ success: false, error: { message, code, details }, http_status }`, always with CORS headers, including on errors.
- Reads `response.ok` before parsing, logs status and Meta error body server-side (token never logged).
- Frontend: `src/pages/WhatsAppTest.tsx` using existing shadcn Card/Input/Button, called via `supabase.functions.invoke("whatsapp-cloud-send")`, reading `FunctionsHttpError` context for the real body. Route `/whatsapp-test` added to `src/App.tsx` inside the `AppLayout` block. No sidebar entry unless you want one.
- Function deployed immediately after writing, then I report name, URL, secret name, and how to test.

## What you do

Paste the Meta access token when the secure form appears, then open `/whatsapp-test` and press send.
