# Wellness module: demo-readiness pass

Goal: no permission ("policy") errors or dead ends anywhere in the Wellness/Balance module — especially the QR check-in → approval → serving deduction flow — before the client demo.

## What I verified so far

- Every wellness table has row-level security policies scoped to signed-in staff or the member who owns the row.
- The check-in request table, approval and rejection functions, the centre-code rotation function and the member self check-in function all exist and are wired to the app hooks.
- Access grants on all wellness tables are currently wider than needed: the "not signed in" role still holds read grants. Policies block it today, so it is not an open door, but it is loose and the security linter keeps flagging privileged functions.

## Plan

### 1. Live end-to-end run-through (the main work)
Drive the real app in a browser and walk the full demo script, capturing every error:

- Staff: sign in → Wellness dashboard, Members, Plans (create/edit/delete), Trials, Batches, Notifications, Achievements, Check-in, QR page (generate, rotate, print/download).
- Member creation → portal login creation → password reset → copy credentials.
- Member: sign in on the portal → scan/enter centre code → request goes to "waiting for approval".
- Staff: pending check-in appears on dashboard and Check-in page → Approve → attendance recorded, one serving deducted, ledger entry written, member portal flips to approved.
- Reject path, duplicate-scan path, expired-code path, member with no active plan, member with zero servings.
- Weight and body-measurement logging by both staff and member.

Every failure found gets fixed in the same pass (missing read permission, wrong role check, missing refresh after an action, silent error toast, etc.).

### 2. Permission tightening (safe, no behaviour change)
- Remove the leftover public/not-signed-in read grants on wellness tables so only signed-in users reach them.
- Restrict the internal maintenance function (stale request cleanup) so it cannot be called from the browser at all.
- Confirm the centre-settings rotation rule is manager-only rather than any staff, matching the rest of the admin actions.

### 3. Flow robustness
- Make sure every check-in outcome (already checked in today, no active plan, servings exhausted, invalid/rotated code, request already handled) shows a clear message instead of a generic failure.
- Confirm the pending-requests list and the member's waiting screen both refresh promptly after approve/reject.
- Confirm staff-initiated check-in from the Check-in page still records immediately (no approval needed) and that member scans never bypass approval.

### 4. Final checks
- Type-check the project.
- Re-run the database security linter and confirm only the intentional, guarded privileged functions remain flagged; update the security memory note accordingly.
- Mobile pass at phone width on the portal and the approval queue.

## Technical notes

- Fixes to permissions go through a single migration: revoke `anon` grants on `public.wellness_*`, `weight_tracking`, `body_measurements`, `serving_transactions`, `member_achievements`, `member_notes`; revoke `EXECUTE` on `expire_stale_checkin_requests` from `anon`/`authenticated`; scope the `wellness_centre_settings` update policy to `is_wellness_manager`.
- `achievement_definitions` keeps read access for signed-in users only.
- No changes to the check-in business logic itself (`member_self_checkin`, `approve_checkin_request`, `checkin_member`) unless the live run-through surfaces a bug — those functions run as security definer and already gate on `is_wellness_staff` / `owns_wellness_member`.
- Browser verification via Playwright at 360x800 and 1280x900 using the seeded staff session and the Pawan Tripathi member account.
