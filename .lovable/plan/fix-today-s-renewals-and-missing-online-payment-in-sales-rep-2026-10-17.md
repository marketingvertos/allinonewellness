# Fix today's renewals and missing online payment in sales reports

## What went wrong (confirmed from today's data)

Today (17 Oct) there are 5 real payments, ₹26,250 in total:
- Anish Ludhiani: ₹7,500 cash (renewal)
- Kalash Mehra: ₹7,500 UPI (renewal)
- Mukesh Kumawat: ₹3,750 online, paid at 8:06 AM (15-visit renewal)
- Mukesh Kumawat: ₹3,750 online, paid at 8:09 AM (15-visit White Card)
- (Pushpa Kumawat paid ₹3,750 cash yesterday, and that payment is also missing from the report)

**Issue 1: the Sales & servings tiles show ₹0.** When a member renews, the app adds the new servings to their existing plan instead of starting a new plan record. The sales tiles, the Revenue card and the sales detail list only count plan records *created* in the chosen dates, so every renewal of an existing plan is left out. The activity cards look at payments instead, which is why "Gold Card UMS renewals (3)" is right while the tiles show ₹0.

**Issue 2: Mukesh's second online payment is missing.** Both Razorpay payments went through and both were added to the same plan (60 servings in total). Each payment overwrites the plan's "amount paid" figure instead of adding to it, so the plan shows ₹3,750 when it should show ₹7,500, and the transactions list shows only one row.

**Also found:** the renewals list labels Mukesh as "Gold Card UMS ₹7,500", because it uses his original plan's name rather than the plan he actually paid for today.

## The fix: payments become the one source for sales numbers

Every money figure will come from the payment records (what was actually collected and when), not from plan records:

1. **Sales & servings tiles** (Today's collection, New, Renewals, Trials): add up today's payments, split by payment type (new, renewal or trial).
2. **Revenue card** (all date filters, comparison with the previous period, new/renewal/trial split) and its **detail list**: one row per payment, with member, plan, mode, reference and date. Split payments are grouped under one sale. Both of Mukesh's payments will show, with a total of ₹7,500.
3. **Revenue report → Transactions** and the cash/UPI/online/card totals: built from payments, so each payment appears on its own row.
4. **Plan name on each payment:** online payments use the plan the member actually paid for. Counter payments use the plan the member is on.
5. **"Amount paid" on the plan** will add up all of its payments instead of keeping only the last one. Existing plans will be corrected once from their payment history (Mukesh's will show ₹7,500).
6. Old plans that have no payment records yet will still be counted from their stored amount, so earlier months don't drop to zero.

## Making sure the numbers stay in step

- I'll add a small automatic check that, for a sample day, the sales tiles, the revenue card, the revenue report and the activity cards all give the same total from the same payments. It will include a renewal of an existing plan and two payments on the same plan.
- I'll review every other place that totals money (Club Reports daily and monthly, the Google Sheets export, PDF and Excel exports) and switch any that still count by plan creation date.
- After the fix, I'll check today's figures against the payment records: ₹26,250 collected, ₹26,250 in renewals, and Mukesh shown twice.

## Technical details

- `useSalesAnalytics` and `useSalesDrillDown` in `src/hooks/useWellness.ts` will read `wellness_payments` filtered on `paid_at` in IST, joined to memberships, members and plans. Classification: `context` (activation→new, renewal/switch→renewal, plan_type trial→trial). Legacy fallback: memberships with no payment rows use `payment_date`/`created_at` + `price_paid`. Use paginated reads.
- `useReports.ts`: the revenue rows come from the payments ledger rather than `wellness_memberships.payment_date`/`price_paid`.
- Plan label: add a nullable `plan_id` to `wellness_payments`, filled by `fulfil_online_payment` from the order and by `record_payment` from the membership. Backfill it from `razorpay_orders` by matching `razorpay_payment_id = reference`.
- Migration: `record_payment` and `fulfil_online_payment` set `price_paid = sum(wellness_payments.amount)` for the membership. A one-time backfill does the same for memberships that have payment rows.
- Audit `get_club_daily_report`, `get_club_monthly_report`, `sync-sheets` and `reportExport` for `created_at` and `price_paid` revenue logic.
- Add a vitest for the shared aggregation helper, next to `dashboardMetrics.test.ts`.
- Record in AGENTS.md: revenue figures come only from `wellness_payments.paid_at`.
