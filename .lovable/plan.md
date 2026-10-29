# Add "Local area" to Start a guest trial

## What changes
- New optional **Local area** text box in the Start a guest trial form, right after Mobile number (e.g. "Vijay Nagar").
- Saved on the guest's member record, so it carries over when the guest converts to a trial or membership.
- Shown on the member profile header and editable in Edit profile.
- Shown as a column in the Trials list and included in its Excel export, to help follow-up calls.

## Technical details
- Migration: `ALTER TABLE public.wellness_members ADD COLUMN local_area text;` (nullable, additive).
- `GuestTrialDialog.tsx`: add state + input, pass `local_area` in the insert payload.
- Member profile/edit form and `WellnessTrials.tsx` list/export: read and display `local_area`.
