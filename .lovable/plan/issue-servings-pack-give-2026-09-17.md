# Issue servings (pack & give)

Let staff hand packed servings to a member who cannot come in, deducting them from the monthly balance and recording them separately from check-ins.

## What changes

**New "Issue servings" dialog**

Opened from two places, for admins and managers:

- A member's plan card (member profile > Plan)
- The check-in screen, next to each member found in the search results

The dialog shows the member's name, the plan and how many servings are left, then:

- **Quantity** — a stepper starting at 1, capped at the servings remaining
- **Reason** — optional text, with hints like "Travelling", "Packed for family", "Home delivery"
- A live line: "After issuing: X servings remaining"
- Confirm button reading "Issue 3 servings"

It is only available when there is an active plan with at least one serving left.

**Clearer serving history**

Serving history rows get proper labels instead of raw words: Plan activated, Check-in, Manual adjustment, Renewal, Refund, and the new **Packed / issued**. Packed entries show the quantity and the note, so it is obvious which servings were consumed at the club and which were handed over.

**Existing +1 / -1 buttons** stay, relabelled "+1 (correction)" and "-1 (correction)" so they are not confused with packing.

**Member portal** gains a serving history list on the History page, using the same labels, so members can see why their balance dropped.

## Rules

- Cannot issue more servings than remain; the server rejects it too.
- Each pack is its own history entry; several packs a day are allowed.
- No WhatsApp message is sent for a pack.

## Technical notes

- Migration 1: `ALTER TYPE public.serving_txn_type ADD VALUE IF NOT EXISTS 'pack_and_issue';` (must be its own migration — a new enum value cannot be used by a function in the same transaction).
- Migration 2: `issue_servings(p_membership_id uuid, p_quantity integer, p_reason text DEFAULT 'Packed for member')` returning the new balance — SECURITY DEFINER, `SET search_path = public`, guarded by `is_wellness_staff(auth.uid())`, locks the membership `FOR UPDATE`, validates quantity ≥ 1 and ≤ `remaining_servings`, updates `remaining_servings`/`used_servings`, inserts a `serving_transactions` row with `txn_type = 'pack_and_issue'`, `change = -quantity`, `created_by = auth.uid()`. `GRANT EXECUTE ... TO authenticated`.
- Regenerate `src/integrations/supabase/types.ts`.
- `src/hooks/useWellness.ts`: `useIssueServings()` mutation next to `useAdjustServings` (line 473), invalidating queries on success.
- New `src/components/wellness/IssueServingsDialog.tsx` using `ResponsiveDialog`, props `{ open, onOpenChange, memberName, membership }`.
- `src/components/wellness/MemberDetailSheet.tsx`: `issueOpen` state, button on the plan card (lines ~395-412), relabel the +1/-1 buttons, and a shared `TXN_LABELS` map replacing the `capitalize`/`replace` render at line 541.
- `src/pages/WellnessCheckIn.tsx`: `issueMember` state and an "Issue" button in the search-result row actions; needs the member's active membership — reuse the existing balances query path to fetch membership id and remaining count.
- `src/pages/portal/PortalHistory.tsx`: add a "Servings" card driven by `useServingLedger(identity.memberId)` with the shared labels.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`.
