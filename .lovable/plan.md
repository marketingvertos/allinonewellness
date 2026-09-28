# 30-serving plans: +2 bonus servings (new joins and renewals)

## The rule
- The **+2 bonus applies only to 30-serving membership plans** (currently "NEW Gold Card UMS-7500" and "RENEWAL -7500-GOLD CARD UMS").
- **New member** who buys a 30-serving plan: gets **30 + 2 = 32 servings**.
- **Existing member** who renews a 30-serving plan **on or before the plan end date**: gets **30 + 2 = 32 servings**.
- **Late renewal** (after the end date): 30 servings, no bonus. (This matches today's "renew on time" rule.)
- **No bonus** on 10-day, 15-visit, trials, Daily Paid or plan switches. Note: 10- and 15-serving plans get +2 today when renewed early. That bonus stops under this rule.
- The bonus is shown as its own line in serving history, e.g. "Joining bonus (+2 servings)" or "Early renewal bonus (+2 servings)", so the 30 purchased servings and the 2 free ones are always clear.

## Where it applies
| Flow | Today | After change |
|---|---|---|
| Staff activates a new membership | 30 | 32 (UMS 30 only) |
| Staff converts a trial into a membership | 30 | 32 (UMS 30 only) |
| Member buys a new plan online (Razorpay) | 30 | 32 (UMS 30 only) |
| Staff renews early (queue / extend / replace) | +2 on any membership plan | +2 on 30-serving plans only |
| Member renews online early | +2 on any membership plan | +2 on 30-serving plans only |
| Late renewal, switch, trials, 10/15 plans | varies | no bonus |

The 1-day trial courtesy visit deduction still applies. For example, a converting guest who used one courtesy visit gets 32 - 1 = 31.

## Screen changes
- Activate membership / Convert trial: when a 30-serving plan is selected, show a green note: "Joining bonus: +2 servings (32 total)".
- Renew plan dialog: show the early-renewal bonus note only when the selected plan has 30 servings and the renewal is on time. The balance preview adds the +2.
- Member portal plan purchase: show "32 servings (30 + 2 bonus)" on 30-serving plans.
- WhatsApp: the existing early-renewal bonus message keeps working. New joins get no extra message. The welcome/membership message shows the 32 balance.

## Existing members
- There is no automatic backfill for members who joined before this change. Staff can add missed bonuses with the existing correction button if needed.

## Technical details
- New migration:
  - Add helper `public.plan_gets_bonus(plan)`: `plan_type = 'membership' AND total_servings = 30`.
  - `renew_membership_v2`: change the bonus condition to `v_is_early AND v_servings > 0 AND plan_gets_bonus(v_plan)`.
  - `create_membership` and `convert_trial_to_membership`: after inserting the membership, if `plan_gets_bonus` and `renewed_from IS NULL`, add +2 to `total_servings`/`remaining_servings` and insert a `manual_adjustment` transaction with the note "Joining bonus (+2 servings)".
  - `fulfil_online_payment` inherits the new behaviour because it already calls `create_membership` / `renew_membership_v2`.
- The rule keys on 30 servings, not plan name or price, so both UMS plans (and any future 30-serving plan) qualify.
- Frontend: `RenewPlanDialog.tsx` (`isEarlyRenewal` also needs `plan.total_servings === 30`), the activation/convert step in `MemberDetailSheet.tsx` and `WellnessTrials.tsx`, and `PayOnlineDialog.tsx` labels.
- Pink Card (+3 for a first UMS 30 at ₹7,500) stays unchanged.
- Verify: new UMS 30 gives 32; early UMS renewal gives 32; late renewal gives 30; early 15-visit renewal gives 15; trial gives no bonus; typecheck passes.
