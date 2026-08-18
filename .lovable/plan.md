# Member login, QR self check-in, and full plan CRUD

Three additions to the Wellness module.

## 1. Member login (mobile number + password)

Members get their own lightweight login, separate from the staff CRM.

- New public route `/portal/auth` with two tabs: **Sign in** and **Activate account**.
- The member types their mobile number (+91, 10 digits) and a password. Behind the scenes the credential uses a deterministic address derived from the number, so the member never sees or needs an email. Email-based password reset therefore won't work for members — staff reset it from the member's profile instead.
- Activation only succeeds if the front desk has already created the member record with that mobile number; otherwise the member is told to visit the centre. This keeps the member list under staff control.
- On first sign-in the account is linked to the existing member record, so history, servings and attendance are already there.
- New route group `/portal` (member-only shell, no CRM sidebar):
  - `/portal` — my plan: remaining servings, plan name, validity end date, today's check-in state.
  - `/portal/checkin` — the scan target (below).
  - `/portal/history` — my visits and weight entries.
- Members reaching `/dashboard` or any CRM route are redirected to `/portal`; staff reaching `/portal` are redirected to `/dashboard`.

## 2. Centre QR — member scans to check in

- Staff page `/wellness/checkin` gains a **Centre QR** tab that renders a large printable QR plus a "Rotate code" button. The QR encodes the portal URL with the centre's current check-in code.
- A member scans it with their phone camera, lands on `/portal/checkin?c=<code>`, and:
  - if not signed in → sent to `/portal/auth`, then back to the scan target,
  - if signed in → the code is validated and today's visit is recorded, one serving deducted, with a clear result screen: success + remaining balance, "already checked in today", "no active plan", or "balance exhausted".
- The code is validated in the database, not the browser, so a screenshot of an old QR stops working after a rotate. Staff-side manual check-in stays exactly as it is today.

## 3. Plans — complete CRUD

`/wellness/plans` currently only creates and updates. Adding:

- **Read**: separate Active / Inactive sections, and a usage count ("used by N memberships") per plan.
- **Update**: existing edit dialog, plus an Active toggle.
- **Delete**: a Delete action in the edit dialog with a confirmation dialog.
  - If the plan has never been sold → the row is permanently removed.
  - If memberships or trials reference it → it is deactivated instead (hidden from all pickers, history untouched), and the confirmation explains this before the user confirms.
- Only admins/managers can delete or deactivate; reps can create and edit.

## Technical notes

- Auth: synthetic address `<10-digit>@members.vertos.in` for `signUp`/`signInWithPassword`; auto-confirm must be enabled so activation works without an inbox. Signup metadata carries `account_type: 'wellness_member'`, which the existing `handle_new_user()` trigger already branches on to link `wellness_members.user_id` by mobile number and skip creating a sales `profiles`/`rep` row.
- Route guarding uses a new `useMemberIdentity` hook: `user_roles` row → staff, `wellness_members.user_id` match → member.
- New table `wellness_centre_settings` (single row: `checkin_code`, `code_rotated_at`) with GRANTs, RLS (staff read/write, no anon), and a new security-definer RPC `member_self_checkin(p_code text)` that verifies the code, confirms `auth.uid()` owns the member record, then calls the existing `checkin_member(..., 'qr_scan')`. No change to existing check-in logic.
- Plan delete: RPC `delete_wellness_plan(p_plan_id uuid)` — manager-only, counts referencing memberships/trials, hard-deletes when zero, otherwise sets `active = false` and returns which happened. `wellness_plans` policies extended for delete by managers.
- Frontend: `qrcode.react` for QR rendering, new `src/pages/portal/*` pages, `src/components/wellness/CentreQrCard.tsx`, `DeletePlanDialog.tsx`, and hooks added to `src/hooks/useWellness.ts` following the existing React Query pattern. All money/dates via the existing IST/₹ formatters, semantic tokens only.
- Demo data: the demo seed gains a ready member login so the portal can be tried immediately.
