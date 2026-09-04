# Fix "Something went wrong" when starting a trial

## What is actually broken

Starting a trial fails for every member, and the guest trial does too. The trial's end date is calculated automatically by the database (start date + duration). The app also sends its own end date with the request, and the database rejects the whole request because that field is not allowed to be written by hand.

Confirmed: no trial has been created since 19 August, and both the "Start trial" dialog and the guest trial send this field.

A second, related problem: the error message shown to the user is a generic "Something went wrong. Please try again." for anything the app does not specifically recognise, which is why this has been invisible until now.

## The fix

1. Stop sending the end date when starting a trial (member trial dialog and guest trial). The centre keeps choosing start date and duration; the end date is derived automatically, exactly as it is for the existing trials in the system.
2. Show the real reason when a save fails. Permission problems and duplicates keep their friendly wording; anything else shows the database's own message instead of the blank "Please try again", so a failure like this is visible immediately.

## Checked end to end for the same class of bug

- No other table in the database has an auto-calculated column, so this specific mistake exists only in the two trial screens.
- Reviewed every place the app writes data (members, plans, memberships, batches, categories, notes, weights, measurements, notification templates, milestones) against the backend's permission rules — each one sends the required ownership field and matches an existing rule. No further gaps found.

## Technical notes

- `wellness_trials.end_date` is `GENERATED ALWAYS AS (start_date + duration_days)`; inserting it raises `428C9`. Remove `end_date` from the payload in `StartTrialDialog.tsx` (line 56) and in `useStartGuestTrial` (`useWellness.ts`, line 1680).
- `useStartTrial` (`useWellness.ts` ~268): keep throwing on the insert error and also check the follow-up `wellness_members` status update error.
- `getErrorMessage` (`useWellness.ts` line 6) falls through to `sanitizeErrorMessage`, which returns the generic string for unmapped errors. Change it to fall back to the raw Postgres message (trimmed) while keeping the mapped, user-safe cases for auth, RLS, duplicates and network errors.
- No migration required.
