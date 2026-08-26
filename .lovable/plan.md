# Check-in approval queue + installable app (PWA)

## 1. Member scans go to an approval queue

Today a member scan records attendance and deducts a serving instantly. New flow:

1. Member scans the centre QR -> a **check-in request** is created (pending). Nothing is deducted, no attendance is recorded.
2. The member's screen shows "Request sent - waiting for approval at the front desk", with live status updates.
3. Admin / manager / staff see a **Pending check-ins** panel at the top of the Wellness dashboard and on the Check-in page: member name, time, plan, servings left, and Approve / Reject buttons.
4. On **Approve**: attendance is punched, one serving is deducted, balance updates, achievements/notifications trigger as they do today.
5. On **Reject**: request is closed with an optional reason, no deduction. Member sees the outcome.

Rules and safeguards:
- Duplicate scans on the same day reuse the existing pending request instead of stacking up.
- Plan validation (expired plan, zero servings) is shown to the approver before they approve, and approval fails safely if servings ran out in the meantime.
- Requests left pending at end of day auto-expire (no deduction).
- **Staff-initiated check-ins** from the Check-in page stay immediate - the approval step applies only to member self-scans.

## 2. Installable app (PWA)

Add home-screen installability so the app can be added from the browser in one tap:
- Web app manifest with app name, short name, theme/background colour, standalone display, and app icons.
- App icons (192/512 + Apple touch icon) generated to match the Vertos/wellness branding.
- Head tags for manifest, theme colour, and Apple touch icon.
- A small "Install app" prompt on the member portal that appears when the browser offers installation (on iPhone it shows the Share -> Add to Home Screen hint).

Offline mode is not included - the app still needs internet. Say the word if you want offline support later.

## Technical notes

- Migration: new table `wellness_checkin_requests` (member_id, membership_id, status pending/approved/rejected/expired, requested_at, decided_by, decided_at, reject_reason) with GRANTs + RLS: members read/insert their own, staff read/update all.
- `member_self_checkin` is changed to create a pending request and return `{status:"pending"}` instead of calling the deduction path.
- New security-definer RPCs `approve_checkin_request(p_request_id)` (wraps existing `checkin_member` logic) and `reject_checkin_request(p_request_id, p_reason)`.
- Frontend: `usePendingCheckIns` (realtime subscription), `PendingCheckInsCard` used on `WellnessDashboard` and `WellnessCheckIn`; `PortalCheckIn` polls/subscribes to its own request status.
- PWA: manifest-only per the PWA guidance - `public/manifest.webmanifest`, icons in `public/`, head tags in `index.html`, plus an `InstallPrompt` component using `beforeinstallprompt`. No service worker.
