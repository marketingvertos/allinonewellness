# Introduced-by tracking, introducer report, cleaner plan lists, 1-day guest default

## 1. "Who introduced you?" — one consistent picker everywhere
Today the public form has a plain text box, and an outside introducer (name + mobile) is only written into notes, so it can't be reported.

- Public registration / 3-day trial form: replace the text box with a choice:
  - **Club member** — type-to-search; shows matching member names (first name + last 4 digits of mobile only, for privacy), pick one.
  - **Someone else** — enter name and mobile.
- Guest trial popup and Create/Edit member already have the member picker; add the same "Someone else" name + mobile fields where missing and save them properly (not just in notes).
- The introducer stays attached when the person moves guest → free trial → paid trial → membership.
- Profile (admin and coach only): an "Introduced by" tag/line with name, plus an **Edit introducer** option to correct old members — choose a club member or type someone else's name and mobile. Changes are recorded in history notes.
- Changing a club-member introducer keeps the existing Pink Card reversal/re-award rules. "Someone else" introducers never earn Pink Card credit.

## 2. Club Owner report — "Who introduced whom"
New tab in Club Reports with period filter (Today / This month / Last month / custom):
- Cards: total new people introduced, by coaches, by club members, by outside people, not recorded.
- Leaderboard: introducer name, role (Coach / Member / Outside), number introduced, how many converted to paid trial / White Card / Gold Card UMS.
- Tap a row to see the list of people they introduced (name, date, current plan, profile link); Excel export.
- "Coach" = members tagged Coach (incl. Shri Chatap).

## 3. Plan lists: new vs renewal
- Guest / lead / free-trial conversion and new member plan pickers show only:
  3 Days Free Trial, 3-Day Paid Trial (750), 15 Visit White Card (3750), NEW Gold Card UMS (7500).
- Renewal pickers show only: 3 Days Renewal (750), 15 Visit Renewal (3750), Renewal Gold Card UMS (7500).
- Each plan gets a "Use for: New members / Renewals" setting in the Plans page, pre-set as above, so future plans sort themselves.
- Note: "3 Days Free Trial" is currently switched off; it will be switched back on. "1st Day Free Trial" and "Daily Paid" will not appear in these lists (still available for guest trials). Tell me if that's wrong.

## 4. Guest trial default
Guest trial popup opens with 1 day / 1 serving selected (3-day still selectable).

## Technical details
- Migration: `wellness_members.referrer_name`, `referrer_mobile` (nullable); same on `wellness_leads`; `wellness_plans.plan_usage text default 'both'` ('new'|'renewal'|'both') and set values for current plans; backfill external referrer from "Introduced by:" notes where parsable.
- `public-register` edge function: accept `referred_by_member_id` or name/mobile; new `search_referrers` action returning id + first name + masked mobile (min 3 chars, limit 10, rate-guarded).
- Carry fields through `approve_lead`, guest conversion and `member-access` conversion paths.
- Report via new security-definer RPC `get_introducer_report(from,to)` (staff only), new tab in Club Reports page.
- Filter plan pickers by `plan_usage` + context (new vs renewal) in conversion, trial change, create membership and renew dialogs.
- Add a vitest for the plan-filter rule (new list vs renewal list).
