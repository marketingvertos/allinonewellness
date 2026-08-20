# Fix member check-in error + in-app QR scanner

## 1. What is breaking on check-in

Confirmed from the live database:

- Members can record attendance (the check-in function allows a member to check themselves in), but the **weight step that runs right after a portal check-in fails**:
  - The weight table's insert rule requires the writer to be *staff*, so a member saving their own weight is rejected.
  - The member profile also blocks a member from changing their own `current_weight` (a safety trigger raises "You can only update your own basic profile details").
- Result: the scan records the visit, then the follow-up weight save throws an error on the member's screen.

### Fix

- Allow a member to insert their own weight row (only for their own member record, only with themselves as recorder). Staff rules stay unchanged.
- Allow the member's own `current_weight` to be updated by that member (keep every other field locked: mobile, status, initial weight, batch, links, ownership).
- Make the portal weight save non-blocking: if anything still fails, the visit stays recorded and the member sees "visit recorded, weight not saved" instead of a hard error.

If the error you are seeing is something else (for example on the staff check-in screen), the same pass adds clearer error text so the exact cause is visible.

## 2. Scan the QR from inside the app

Today the QR has to be scanned with a third-party camera app. Add a built-in scanner:

- **Member portal → Check in**: a large "Scan QR to check in" button that opens the phone's rear camera in a full-screen scanner sheet. On a successful read of the centre code, the check-in runs immediately, servings deduct, and the optional weight field appears.
- Works when the page is opened directly at `/portal/checkin` (no link needed) — this becomes the primary way members check in.
- Permission handling: clear prompt to allow camera, and a fallback "enter centre code manually" input if the camera is unavailable or blocked.
- **Staff check-in page** gets the same scanner button so the front desk can scan a member from the tablet.
- Existing behaviour (opening the link from an external camera app) keeps working unchanged.

## Technical notes

- Migration: add a member-scoped INSERT policy on `weight_tracking`; relax `guard_member_self_update` to permit `current_weight` when the row belongs to the caller. No schema changes.
- Scanner: use `@zxing/browser` (works across iOS/Android Safari and Chrome) with the native `BarcodeDetector` used when available; camera constrained to `facingMode: environment`.
- New component `src/components/wellness/QrScannerSheet.tsx`, used by `src/pages/portal/PortalCheckIn.tsx` and `src/pages/WellnessCheckIn.tsx`; it parses the scanned URL, extracts the `c=` code and calls the existing self check-in function.
- Portal weight save moves out of the check-in mutation's failure path so a weight error can never mark the check-in as failed.
