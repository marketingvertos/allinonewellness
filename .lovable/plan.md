# MIW 21-Day Challenge

## What members and staff will get

**Admin / owner**
- New "MIW Challenges" section under Events: create a challenge with a start date (end date auto = start + 20 days, editable), registration fee (default ₹500), and open/closed status. One challenge open for registration at a time.
- New "MIW" tag alongside Coach, PC, MRP and Supervisor.
- When staff switch the MIW tag on (from the profile or Edit form), a small dialog asks for the challenge, amount paid (default ₹500) and payment mode (Cash / UPI / Online / Card, with optional split). The payment is saved to the payment ledger, so it appears in Revenue and Sales as "MIW registration".
- Switching the tag off asks for confirmation; the payment record stays for audit.

**Member app**
- Home screen shows a "Join MIW 21-Day Challenge" card while a challenge is open and the member is not yet registered.
- Tapping it opens a Razorpay payment for ₹500. Once payment is confirmed, the member is registered and tagged MIW automatically; the card changes to "You're in — Day X of 21" with weight lost so far.

**MIW Report (Events > MIW)**
- Challenge picker with month filter to open any past challenge (July, August, September, etc.).
- Summary: participants, paid amount collected, average and total weight lost, number who lost weight.
- Participant table: name, start weight (first reading on/before day 1), latest weight within the 21 days, change in kg, visits during the challenge, days attended out of 21, rank.
- Tap a member to see their day-by-day weight journey chart.
- Excel and branded PDF download, named after the challenge.

## Rules
- Weight change uses readings already recorded at check-ins and weigh-ins within the challenge dates.
- A member can join a given challenge only once; paying twice is blocked.
- MIW fee is separate from membership — no servings, no Pink Card credit, no effect on titles.
- MIW tag is removed automatically when a challenge ends? No — tag stays for history; report is per challenge.

## Technical details
- New tables `miw_challenges` (name, start_date, end_date, fee, status) and `miw_participants` (challenge_id, member_id, payment_id, source staff/online, joined_at, unique per challenge) with grants + RLS: staff manage, members read their own.
- Security-definer RPCs: `miw_register_member` (staff, records payment via existing ledger with context `miw`), `miw_report(challenge_id)`.
- Razorpay: extend `razorpay-create-order` / `verify` / `webhook` and `fulfil_online_payment` with a `miw` context; idempotent fulfilment adds participant + `miw` tag.
- `wellness_payments.membership_id` is required today; add a nullable path (new nullable `miw_participant_id`, relax via additive change) so MIW payments don't need a membership; sales ledger classifies `miw` as its own category.
- Add `{ value: "miw", label: "MIW Challenge" }` to `MEMBER_TAGS`.
- Tests for: one registration per challenge, ₹500 default, MIW revenue counted separately, weight change calculation.
