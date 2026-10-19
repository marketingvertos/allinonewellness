# Unblock check-ins by servings, without changing plan dates

## The situation
The live database is refusing the permanent rule update (it reports success but nothing changes, same as the earlier MIW fix). So the old rule still blocks members whose plan end date has passed, even with servings left. Right now 24 members are affected, including SHRI CHATAP (3 left) and SNEHAL CHATAP (1 left). Plan dates will **not** be changed.

## The fix
Check-ins will go through a new backend function that runs the servings-only rule itself. It doesn't depend on the database update, which is the same approach that fixed MIW removal.

1. **Member QR scan:** the member scans and the request goes to the front desk as usual. It is accepted while servings remain, whatever the end date.
2. **Front-desk / admin check-in and approving a QR request:** the visit is recorded, 1 serving is deducted, and the serving history and attendance entry are written. The check-in WhatsApp goes out exactly as today.
3. **Blocked only at 0 servings:** "No servings left on your plan. Please renew." The 10-day renewal-due window and later expiry stay unchanged.
4. **Unchanged:** trials, guest day-2 visits, packed-serving days, one visit per day, and Wednesday evening WLP routing. These still use the existing rules, because the end date only matters for memberships.
5. When the database update finally applies, the same rule is already written there, so nothing changes for staff or members.

## Check after the fix
- SHRI CHATAP scans → request appears → staff approve → 3 becomes 2, and the attendance shows today.
- A member at 0 servings is still refused.
- An ordinary member whose end date hasn't passed checks in exactly as before.

## Technical details
- New edge function `servings-checkin` (validates JWT; staff via `is_wellness_staff`, member via own `user_id`). Actions:
  - `self_request(code, weight)`: validate the centre code, and do the duplicate/pending checks. If there is an active trial, or no membership has servings, delegate to the existing `member_self_checkin` RPC (keeps WLP/trial/advance logic). Otherwise insert the `wellness_checkin_requests` row with the servings-based membership.
  - `staff_checkin(member_id, method)` and `approve(request_id)`: when the member has no active trial and has an active/expiring_soon membership with `remaining_servings > 0`, do the attendance insert, membership decrement and `daily_deduction` transaction with the service role (row lock via conditional update `remaining_servings > 0`), and mark the request approved and linked. Otherwise delegate to the existing RPCs.
- Frontend: `useWellness.ts` check-in, approve and portal self check-in hooks call the function. Responses use the same `{status, message, remaining}` shape, so the screens are unchanged.
- The migration `0068_checkin_servings_only` stays in the repo for when the database accepts updates.
