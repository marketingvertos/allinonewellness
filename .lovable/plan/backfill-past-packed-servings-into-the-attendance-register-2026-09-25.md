# Backfill past packed servings into the Attendance register

Older packed servings were given before the Attendance register counted them, so they don't show as "S". This one-time fix adds them.

## What was found
- There are 18 past packed-serving entries, dated 18 to 25 Sep. None is linked to an attendance day.
- Most of them fall on a day when the member already has a club visit recorded. Those days already show a tick, and they stay as they are.
- About 6 entries fall on days with no attendance, for example 18 Sep, 22 Sep, 23 Sep, 24 Sep and 25 Sep. Only these days will change from a cross to an "S".
- A few older packs covered more than one serving (for example 4 or 2). Back then no dates were chosen, so each of these counts as one "S" on the day it was packed. No extra days are guessed.

## What changes
- One attendance day marked "S" is added for each packed-serving date that has no attendance yet.
- Each added day is linked back to its packed-serving entry in the history.
- **Servings are not deducted again.** Balances stay exactly as they are.
- **No WhatsApp messages go out**, because packed days are already excluded from the check-in message.

## Technical details
- Data-only change through run_sql, with no schema migration:
  - Insert `wellness_attendance` rows (`checkin_method='serving_issue'`, `visit_date` = IST date of `created_at`, `visit_time` = that date at 09:00 IST, `serving_deducted=true`, `remaining_balance_snapshot = balance_after`, `staff_id = created_by`, and the member/membership ids). One row per member per date, using `ON CONFLICT (member_id, visit_date) DO NOTHING`.
  - Update `serving_transactions.attendance_id` for the transactions whose row was inserted.
- Verify afterwards: count the `serving_issue` rows, then open Attendance → Monthly (Physical and All) and confirm the "S" cells, for example on 22 and 25 Sep.
