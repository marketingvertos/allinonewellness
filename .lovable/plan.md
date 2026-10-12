# Fix "Could not change plan — column end_date can only be updated to DEFAULT"

## What was found
- The system works out a trial's end date by itself from the start date and the number of days. It cannot be typed in or saved directly.
- Today's update that added the "Trial start date" option also tried to save the end date by hand. The database refuses that, so every **Change plan** now fails with this error. This includes Ganpat Kumawat's change to the 3-Day Paid Trial.

## The fix
- The plan change saves only the new plan, number of days and start date. The end date then updates by itself, for example 13 Oct + 3 days.
- Everything else stays the same:
  - The trial is set back to active when the new end date is today or later.
  - Pink Card credit is given or taken back as before.
  - The member's notes record the change, the new start date and the payment mode.

## Technical details
- New migration replacing `public.change_trial_plan(uuid, uuid, integer, text, date)`. The body is identical except the `UPDATE wellness_trials` drops `end_date = v_end` (`end_date` is `GENERATED ALWAYS AS (start_date + duration_days)`). `v_end` stays computed for the status check.
- Verify:
  - Call the function's logic on a test trial through the UI in the preview, signed in.
  - Confirm with a query that `end_date` equals `start_date + duration_days` and the status is active.
