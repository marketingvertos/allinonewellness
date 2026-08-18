# Create Pawan Tripathi's member profile with real progress

Set up a live member record with the actual data provided, seed the real journey from 26 June to today (18 August), and hand back a working portal login.

## Profile


| Field           | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Name            | Pawan Tripathi                                          |
| Gender          | Male                                                    |
| Mobile          | +91 9815064617                                          |
| Joining date    | 26 Jun 2026                                             |
| Height          | 175 cm                                                  |
| Starting weight | 82.7 kg                                                 |
| Current weight  | 75.6 kg                                                 |
| Target weight   | 70 kg (adjustable — say if you want a different target) |
| Goal            | Weight loss                                             |
| Status          | Active member                                           |


## Progress data seeded

- **Weight log** — weekly entries from 26 Jun (82.7 kg) tapering to 18 Aug (75.6 kg), following a realistic loss curve (faster in the first three weeks, then steady ~0.7 kg/week) so the portal chart and the staff progress tab show the real 7.1 kg drop.
- **BMI** — computed from 175 cm: 27.0 at start, 24.7 today (out of overweight, into normal range).
- **Membership** — "Transform — 90 Servings" starting 26 Jun 2026, 90 days, ₹14,500, so the plan is active and covers the whole period.
- **Attendance** — check-ins for the days between 26 Jun and 18 Aug, Monday–Saturday with a few natural gaps (~45 visits), each with the matching serving-ledger deduction, so the remaining balance, visit history and the servings ledger all reconcile.

## Login

- A portal login is created for mobile **9815064617** with the password you gave, already linked to the member record (no activation code needed).
- Link: `https://allinonewellness.lovable.app/portal/auth` — sign in with mobile `9815064617` and your password.
- Once signed in: **My plan** shows servings left and validity, **Check in** works with the centre QR, **History** shows every visit and the weight log.

## Technical notes

- Auth user created with the deterministic credential address `9815064617@members.vertos.in` (the same scheme the portal uses), then `wellness_members.user_id` is linked to it.
- Rows written with the data tool: one `wellness_members` row, one `wellness_memberships` row (with the allocation transaction), `weight_tracking` entries, and `wellness_attendance` + `serving_transactions` pairs with consistent `remaining_balance_snapshot` values and matching `used_servings` / `remaining_servings` on the membership.
- No schema changes; this is data only.