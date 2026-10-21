# Fix: Sales & servings cards show 0 (Sumed Jamgade's membership missing)

## What was found
- Sumed's membership is saved correctly: NEW Gold Card UMS-7500, started today, ₹7,500 UPI recorded today, no longer marked guest.
- The problem isn't about Sumed. The whole Sales row is broken: it shows 0 servings, but 52 visits are recorded today.
- Cause: when sales are loaded, the app also reads MIW payments and filters out "voided" ones. A recent MIW change expected a "voided" field to be added to the database. That change never went live, so the field doesn't exist. The database rejects the whole request, and every card falls back to 0. The revenue report and sales drill-downs use the same loading step, so they break too.
- **Why it keeps happening:** several recent database changes said they had applied but never went live. App code was then written as if they had. This is the same pattern behind the earlier MIW removal and trial-conversion errors.

## Fix
1. Stop the sales loader from relying on the missing "voided" field. Removed MIW registrations are already deleted outright, so nothing changes in the totals.
2. Let one failing part (for example MIW) fail quietly, so it can't zero out the whole Sales row again.
3. Gap check: compare every database field the app reads with the live database, and fix any other reads of fields that don't exist.
4. Verify: Today's collection shows ₹7,500 and New today shows Sumed. The revenue report loads too.

## Technical details
- `src/hooks/useWellness.ts` `fetchSales`: drop `.is("voided_at", null)` on `miw_payments`; check `miw.error` without throwing (log it, skip MIW lines).
- Script: run `rg` for `.select(`/`.is(`/`.eq(` column names against `information_schema.columns` to catch other phantom columns (e.g. ones from unapplied migrations 0061–0072).
- Add a test in `salesLedger.test.ts` that a missing MIW source still returns membership sales.
