# Fix: WLP attendance not working today (Wed 21 Oct 2026)

## What I found
- There is **no WLP session for today, 21 Oct**. The only upcoming session is dated **23 Oct** (Friday), created on 16 Oct, with 0 check-ins. It was most likely meant for 21 Oct.
- Without a session for today, the evening QR scan falls back to a normal club check-in, and staff can't mark WLP attendance.

## Fix now
1. Move the empty 23 Oct session to **21 Oct** (or create a new 21 Oct session if you want to keep 23 Oct too).
2. Members can then scan the same QR (after 4 PM) or staff can mark them on the WLP page. Anyone who already scanned this evening and was counted as a club visit can be moved to WLP by staff.

## Stop it happening again
- On the WLP page, show a clear banner after 4 PM if no session exists for today, with a one-tap **Create today's session** button.
- On the session creation form, warn when the chosen date is not today.

## Technical details
- Update `wlp_sessions.session_date` for id ab67357c… to 2026-10-21 (no check-ins attached, so safe).
- Add the banner/button in `src/pages/WellnessWlp.tsx` using the existing `create_wlp_session` RPC.
