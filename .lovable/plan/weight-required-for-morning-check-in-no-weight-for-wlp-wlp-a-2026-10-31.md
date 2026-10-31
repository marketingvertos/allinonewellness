# Weight required for morning check-in, no weight for WLP, WLP attendance message

## What changes
**Morning club check-in (member phone):**
- After scanning, the **Today's weight (kg)** box is required. "Request attendance" stays disabled until a valid weight (1–400 kg) is entered; the hint changes from "Optional" to "Required".
- The backend also rejects a morning self check-in with no weight, so it can't be skipped from an old app version.
- Front-desk/staff check-ins are not affected.

**WLP (Wednesday evening, after 4pm):**
- When the member scans during WLP time, no weight box is shown. They see a single **"Punch WLP attendance"** button with a short note that this is the Balanced Living Program session.
- On success they see the existing "WLP attendance recorded" screen.

**WLP WhatsApp message:**
- A WLP attendance message already exists (`wlp_checkin_confirmed`) and has sent 13 times, so it keeps sending as it does now.
- I'll submit a clearer new **Utility** template to Meta and stage it as the replacement. Members keep getting the current message until Meta approves the new one, then it switches over automatically.

Draft text (English, Utility):
```text
Hi {{1}}, your attendance for the Balanced Living Program (WLP) session on {{2}} has been recorded at All In One Wellness. Servings remaining: {{3}}. Thank you for joining us — see you at the next session.
```
Variables: member name, session date, servings remaining.

## Technical details
- `PortalCheckIn.tsx`: work out IST time on the client (Wednesday, 16:00 or later) → WLP mode UI with no weight, calls the same self check-in with weight null; otherwise weight required (`weightNum == null` disables the button).
- Migration: in `member_self_checkin`, outside the WLP branch, return `{status:'weight_required'}` when `p_weight` is null; UI shows the message for that status. Edge function `servings-checkin` passes it through unchanged.
- Template: POST to Meta through the existing template-submission path as `wlp_attendance_confirmed` (en, UTILITY, with body examples); set `next_template_name`/`next_variables` = `[name, session_date, wlp_remaining]` on the `wlp_checkin` row. The runner promotes it once it's approved (existing staged-replacement logic).
