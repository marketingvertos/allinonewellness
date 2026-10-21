# Mark guest trial members in WLP sessions

## What you'll get
- On the WLP page, the member search also finds people on a guest trial (free or paid), with a "Trial" label and how many trial visits are left.
- Tapping **Check in** marks them in tonight's WLP session, the same as members.
- A WLP visit uses one of their trial visits. When all trial visits are used, it counts as an extra visit, the same rule as the Trials page.
- Their WLP visit shows as "W" in attendance and in the trial's visit count, and stays out of the morning club "Present" totals.
- Evening QR scans by trial guests after 4 PM on a WLP day also go into the WLP session.
- No WhatsApp message is sent for these check-ins.

## Checks
- Mark one trial guest in today's session and confirm they appear in the session list, their trial visit count goes up by 1, and the club Present count does not change.
- Undo removes the WLP mark and gives the trial visit back.

## Technical details
- `wlp_checkin_member`: when the person has no active membership but has an open trial (`active`/`expired`, not converted/cancelled), record the `wlp_checkins` row with `serving_deducted=false` and link the trial; return `warning: 'trial'` plus used/total visits instead of `no_membership`.
- Add nullable `trial_id` to `wlp_checkins`; trial visit counts (Trials page, `mark_trial_attendance`) add WLP check-ins linked to the trial. Undo deletes the row, which restores the count.
- WLP search: include guests on open trials (current member search filters out `is_guest`).
- Evening QR routing: apply the same trial branch.
- Verify the migration by reading back the live function after applying; fall back to the `member-access` edge function if it does not take effect.
