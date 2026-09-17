# Split payment recording

Record how a member actually paid — cash, UPI, online or card — including payments split across two or more methods (for example ₹4,000 cash + ₹3,500 UPI on a ₹7,500 plan).

## What the app already does

Activating a plan, renewing and switching already ask for an amount collected, and activation and renewal also ask for a payment method and payment date (stored as single values on the membership). What is missing is the ability to record **more than one** payment line for the same transaction, a reference number per payment, and a proper payment history.

## What changes

**1. A payment box used in three places**

Activating a plan (member profile > Plan), Renew plan and Switch plan all get the same payment box:

- Amount, and a pill selector for Cash / UPI / Online / Card
- An optional reference field (UPI transaction ID, card last 4, receipt number)
- An "Add split payment" button — adds a second line, pre-filled with whatever is still unpaid; up to 4 lines, each removable
- A running total at the bottom: green tick when it matches the plan price, amber note when it is short or over

A mismatched total is allowed (partial payment or an off-book discount) — it only shows a warning, it never blocks saving. Lines with no amount are ignored; at least one line with an amount is required.

**2. Payment history on the member**

The member's Plan tab shows a "Payment breakdown" under the current plan: each line with its method, reference, amount and date. Memberships created before this change show nothing extra — their single amount keeps showing as it does today.

**3. Revenue report**

The Revenue tab keeps working as-is, and gains a per-method breakdown driven by the new payment lines, so a split payment counts correctly under each method instead of being lumped into one.

## Rules

- Payment date stays on the transaction; the existing payment-date field continues to be filled from the first line.
- Pink Card discount continues to reduce the amount due, and the payment box re-fills with the discounted amount.
- Only admins/managers see and use this — nothing changes in the member portal.
- No WhatsApp message for recording a payment.

## Technical notes

- Migration: `payment_mode` enum (`cash`,`upi`,`online`,`card`); `public.wellness_payments` (id, membership_id → wellness_memberships ON DELETE CASCADE, member_id → wellness_members, amount numeric(10,2) CHECK > 0, mode payment_mode, reference text, note text, context text default `'activation'`, paid_at timestamptz default now(), recorded_by uuid, created_at); indexes on membership_id and paid_at; GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`; RLS enabled with a staff policy using the existing `public.is_wellness_staff(auth.uid())` / `is_wellness_manager` helpers (the guide's `user_profiles` check does not exist in this project and is not used).
- RPC `record_payment(p_membership_id uuid, p_member_id uuid, p_payments jsonb, p_context text default 'activation')` — SECURITY DEFINER, `SET search_path = public`, guarded by `is_wellness_staff(auth.uid())`, rejects an empty array, inserts one row per element, sets `price_paid` on the membership to the summed total, and also syncs the existing `payment_mode` / `payment_date` columns from the first line for backward compatibility. GRANT EXECUTE TO authenticated. Types regenerate automatically after the migration — no hand-editing of `types.ts`.
- New `src/components/wellness/PaymentInput.tsx` exporting `PaymentLine`, `createDefaultPayment(total)` and a controlled `PaymentInput` using the existing `ToggleGroup`; semantic tokens only for the balanced/unbalanced states.
- `src/hooks/useWellness.ts`: add `useRecordPayment()` and `usePaymentHistory(membershipId)`; `useCreateMembership` already returns the new membership id, and `useRenewPlan` / `useSwitchPlan` return the resulting membership id — payments are recorded against the returned id (renewal in queue/replace mode creates a new membership row).
- `MemberDetailSheet.tsx`: replace the activation amount/method inputs (lines ~463-490) with `PaymentInput`, keep the payment-date field, call `recordPayment` after the membership is created, and render the payment-breakdown block in the Plan tab.
- `RenewPlanDialog.tsx` and `SwitchPlanDialog.tsx`: swap the single "Amount collected" input for `PaymentInput`, keep the existing payment-date picker in the renew dialog, and record lines after the mutation resolves.
- `useReports.ts`: add a payments-based per-mode aggregate for the Revenue tab; leave the existing membership-based rows in place.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`.
