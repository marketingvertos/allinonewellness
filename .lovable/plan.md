# Issued servings visible in past history

Packed servings are already deducted from the monthly balance, but the history only shows a date. Make every issued pack fully traceable: when, at what time, why, how many, and who gave it.

## What changes

**Member profile > Servings**

Each row shows:

- The label (Packed / issued, Check-in, Renewal, and so on)
- Date **and time** together, e.g. 17 Sep 2026, 6:10 PM
- The reason typed while issuing
- Quantity issued and the balance left after it
- The staff member who issued it ("by Shri Chatap")

**Member profile > Visits**

Today the Visits tab lists only club check-ins, so a packed serving looks like a missing day. Packed entries now appear in the same list, marked "Packed / issued" with the time, reason and quantity, so the whole consumption story sits in one place, newest first.

**Member portal > History**

The member's Servings list gets the same date + time and reason, so they can see exactly when servings were handed over.

## Rules

- Nothing changes about how servings are deducted; this is display only.
- Members see the date, time, reason and quantity, but not internal staff notes beyond the reason.
- WhatsApp messages for issued servings are not part of this change; noted for a later round.

## Technical notes

- `src/components/wellness/servingLabels.ts`: no change to labels; add nothing new.
- `src/hooks/useWellness.ts` — `useServingLedger`: extend the select to join the issuing staff name (`profiles` by `created_by`) and keep ordering by `created_at desc`.
- `src/components/wellness/MemberDetailSheet.tsx`:
  - Servings tab (lines 548-567): swap `formatDate(t.created_at)` for `formatDateTime`, render the reason on its own line, and append "by {name}" when the profile is resolved.
  - Visits tab (lines 533-546): merge `attendance` with ledger rows where `txn_type === 'pack_and_issue'` into one array sorted by timestamp desc; packed rows render the label, time, quantity and reason.
- `src/pages/portal/PortalHistory.tsx`: Servings card uses `formatDateTime`; reason on its own line.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`.
