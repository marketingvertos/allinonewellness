# One QR for Club + WLP Attendance

## Goal
Members scan the same centre QR all day. Morning scans count as club check-ins; evening scans (from 4:00 PM India time) automatically count as that day's WLP session — no separate WLP QR needed.

## How it will work
- **Before 4:00 PM (IST):** scan behaves exactly as today — club check-in with weight entry, serving deduction, approval flow, WhatsApp message.
- **From 4:00 PM (IST):** the scan checks whether a WLP session exists for today.
  - Session exists → the member is checked into that WLP session (1 serving deducted as a WLP serving, overdraft allowed as today).
  - No WLP session that day → falls back to a normal club check-in, so the QR never dead-ends.
- The WLP entry is recorded separately in the WLP session's attendance list, exactly like the current WLP QR — club check-in counts, reports, and dashboards stay unchanged.
- The confirmation screen tells the member which one was recorded: "Club check-in" vs "WLP session check-in", with servings remaining.
- The existing per-session WLP QR page keeps working as a fallback (e.g. a special daytime session).

## Technical details
- Update the `member_self_checkin` database function: after validating the centre code, compare current IST time against the 4 PM cutoff and look up today's row in `wlp_sessions`; if found, delegate to the existing WLP check-in logic (`wlp_self_checkin` path: insert into `wlp_checkins`, deduct a `wlp_deduction` serving) and return a `mode: "wlp"` result.
- Weight capture is skipped for WLP-routed scans (evening weigh-ins aren't part of WLP today).
- Frontend: the member scan/confirmation screen reads the returned `mode` and shows the appropriate message; no new pages or QR posters.
- No changes to staff-side WLP page, reports, or the morning flow.
- Guard: a member already checked into today's WLP session gets the "already checked in" response, never a double deduction.

## Verification
- Typecheck + build.
- Database check that the function routes correctly both sides of the cutoff (simulated time), and that a day without a WLP session still does a club check-in.
