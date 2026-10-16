# Turn on WLP Sessions + mark 14 Oct 2026 attendance

You don't need to run anything in an SQL editor. I'll apply the setup directly.

## 1. Turn on WLP Sessions
- Apply the uploaded WLP setup as-is: the sessions list, check-ins, the QR self check-in and undo.
- The new "WLP serving" type is added in its own step first, then everything else.
- As you chose, WLP check-ins can take a balance below zero, with a warning. Morning club check-ins still stop at zero.

## 2. Mark the 14 Oct 2026 WLP session
- Create a "WLP Session" for 14 Oct 2026.
- Check in these 7 members. Each one uses 1 serving from their active plan:
  - Anubhav Jain
  - Radha Tiwari
  - Darshana Kaur Tuteja
  - Jaswant Kaur khalsa
  - Pawan Tripathi
  - Snehal Chatap
  - Trappti Paraye
- Anuj is skipped because he isn't in the system. You can check him in later from the WLP page.
- No WhatsApp messages are sent for these back-dated check-ins.

## 3. Check
- The WLP page opens and shows the 14 Oct session with 7 members checked in.
- Each member's serving history shows the WLP serving, and their balance goes down by 1.
- If a member has no active plan, I'll list them by name.

## Technical details
- Apply `drizzle/migrations/0051_wlp_sessions.sql` in two migrations: the `ALTER TYPE ... ADD VALUE 'wlp_deduction'` alone, then the rest. This includes dropping `remaining_not_negative`, which you approved.
- Back-fill the check-ins through the same deduction logic as `wlp_checkin_member`, using session_date 2026-10-14. This writes the `wlp_checkins` rows, the `serving_transactions` row (wlp_deduction, -1) and the membership balance update.
- Record the rule in AGENTS.md: WLP check-ins live in their own sessions and check-ins tables, separate from club attendance.
