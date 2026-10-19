# Check-in follows servings only, not the plan end date

## The problem
SHRI CHATAP has an active membership with **3 servings left**, but the plan's end date was 17 Oct. The check-in rules still compare today against the end date, so his scan says "Membership renewal needed". **24 members** are in the same position right now (servings left, end date passed), e.g. SNEHAL CHATAP (1 left).

## The fix (permanent, all members)
A membership stays usable as long as servings remain. The end date is shown for information only and never blocks anything.

1. **QR scan, front-desk check-in, admin entry, check-in approval, WLP evening check-in:** allow the visit whenever the active plan has servings left, whatever the end date.
2. **Queued plans:** a waiting plan only activates when the current plan's servings reach 0 (no longer when the end date passes).
3. **Renewal flow unchanged:** servings reach 0 → Renewals due for 10 days → Membership Expired.
4. **Message wording:** "Membership renewal needed — your membership has ended" changes to "No servings left on your plan. Please renew." so it matches the real reason.
5. **Existing members:** the 24 affected members can check in immediately once this is live — no data changes needed, their statuses are already active.

## Check after the fix
- SHRI CHATAP scans (or front desk checks him in) → visit recorded, 3 → 2 servings.
- A member at 0 servings is still blocked with the renew message.

## Technical details
- Migration replacing `checkin_member`, `member_self_checkin`, `activate_next_membership` (and WLP check-in RPC if it has the same check): remove every `end_date >= v_today` / `end_date < v_today` condition on memberships; select the active/expiring_soon membership by `remaining_servings > 0`, ordered by `start_date`. `activate_next_membership` only promotes queued plans when the current one has `remaining_servings <= 0`.
- `refresh_wellness_statuses` already ignores membership end date (trial expiry by date stays).
- Portal check-in screen copy for the `renew_required` result.
