# Online payments with Razorpay

Members pay from their own portal — renewals, new plans and trials — with Pink Card credits applied first. Live mode from day one.

## What the member sees

1. On the portal home, a **Pay online** card appears whenever money is due: renewal due, no active plan yet (plan choices shown), or a trial with a price.
2. They pick the plan, see the price, the Pink Card discount applied automatically, and the final amount to pay.
3. Tapping **Pay** opens the Razorpay checkout sheet (UPI, cards, netbanking, wallets) over the app.
4. On success they see a confirmation with the amount and new serving balance; the plan is live immediately.
5. If they cancel or payment fails, nothing changes and they can retry.
6. Every paid renewal appears in their history, and the team sees it in the member's plan card and the Revenue report as an "Online" payment.

## What the team sees

- Payments made by members land in the same payment ledger the team already uses, marked online with the Razorpay reference number.
- The plan is activated/renewed automatically — no manual entry needed.
- Pink Card credits used in an online payment are deducted exactly as they are for counter renewals.
- A WhatsApp confirmation is not part of this round.

## Setup required from you

Razorpay live keys are needed before this can go live. From the Razorpay dashboard (Account & Settings → API Keys, in Live mode) you will need to provide:

- Key ID
- Key Secret
- Webhook secret (created when we add the webhook URL to Razorpay)

I will ask for these securely once the payment screens are built, and give you the webhook URL to paste into Razorpay at the same time. Live payments also require your Razorpay account to be activated (KYC complete).

## Technical scope

**Database (one migration)**
- `razorpay_orders` table: id, member_id, plan_id, context (`activation` | `renewal` | `trial`), amount_paise, pink_credits, razorpay_order_id, razorpay_payment_id, status (`created` | `paid` | `failed`), membership_id (filled after fulfilment), created_at. RLS: members read their own rows; staff read all; only service role writes. GRANTs included.
- No change to `wellness_payments` — Razorpay payments are recorded there through the existing `record_payment` RPC with mode `online` and the payment id as `reference`.

**Edge functions**
- `razorpay-create-order` (JWT validated in code): resolves the caller's member, computes price server-side from the plan, subtracts Pink Card discount (capped at balance and price), creates the Razorpay order via `POST /v1/orders`, stores the row, returns order id + key id + amount. Client-supplied amounts are never trusted.
- `razorpay-webhook` (`verify_jwt = false`): verifies `X-Razorpay-Signature` HMAC-SHA256 against the webhook secret, handles `payment.captured` / `payment.failed`, idempotent on `razorpay_payment_id`. On capture it runs the same server logic the counter uses — `create_membership` / `renew_membership_v2` / trial conversion, `redeem_pink_card` for credits used, then `record_payment` with mode `online` — inside a single flow, so a double webhook cannot double-credit.
- `razorpay-verify` (optional fast path): called by the client right after checkout returns, verifies `razorpay_signature` and triggers the same fulfilment so the member sees the result immediately; webhook stays the safety net.

**Client**
- Razorpay Checkout script loaded on demand (`https://checkout.razorpay.com/v1/checkout.js`), not bundled.
- New `src/components/wellness/PayOnlineDialog.tsx`: plan picker, price + Pink Card lines, calls `razorpay-create-order`, opens checkout, handles success/dismiss, then invalidates membership/ledger/pink-card queries.
- `PortalHome.tsx` gains the **Pay online** card; `PortalHistory.tsx` shows online payments in the servings/payment history.
- Secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Key id is also returned by the create-order function so nothing is hardcoded in the client.
- `supabase/config.toml` gets `verify_jwt = false` for `razorpay-webhook` only.

**Out of scope for this round:** refunds from inside the app, saved cards/auto-debit subscriptions, WhatsApp receipts, staff-initiated online payment links.
