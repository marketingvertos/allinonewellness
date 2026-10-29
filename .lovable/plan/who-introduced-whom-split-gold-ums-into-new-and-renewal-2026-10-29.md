# Who introduced whom: split Gold UMS into New and Renewal

Right now the Gold UMS column in the report counts anyone whose latest plan is Gold UMS, so new joiners and renewals land in the same number.

## What changes
- The single "Gold UMS" column becomes two columns: **New Gold UMS** and **Renewal Gold UMS**.
- **New Gold UMS**: the member's first Gold UMS membership (no earlier Gold UMS and no renewal payment on it).
- **Renewal Gold UMS**: the member's Gold UMS has a renewal payment, or they had an earlier Gold UMS membership.
- A member counts in only one of the two, never both.
- Both numbers can be clicked to open the list, same as today. The Excel export gets both columns too.
- Paid trial and White Card columns stay as they are.

## Technical details
- Update `get_introducer_report` to also return `gold_type` ('new' | 'renewal' | null), worked out from `wellness_memberships` count per member on Gold plans and `wellness_payments.context = 'renewal'` on the latest membership.
- In `IntroducerReport.tsx`, split the `gold` bucket into `gold_new` / `gold_renewal` from that field; update the table header, cells, totals and export.
- Add a small test for the new-vs-renewal rule.
