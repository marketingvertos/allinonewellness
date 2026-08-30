# Weight entry at member check-in request + approval

Today a member scans the QR, a pending request is created, and the front desk approves it. Weight can only be entered *after* approval, and the approver never sees it. This change moves weight capture into the request itself.

## New flow

1. Member scans the centre QR. Instead of firing the request immediately, the portal shows a short "Request attendance" screen with a weight field (kg) and a **Request attendance** button. Weight stays optional — the member can skip it.
2. The request is created as pending, carrying the weight the member entered.
3. The staff Pending check-ins card shows the member's submitted weight next to their name, alongside their previous weight and the change (e.g. "75.6 kg · −0.4 kg since last"). No weight submitted shows "No weight entered".
4. The approver can correct the value in an inline field before approving (typo / scale mismatch).
5. On **Approve**: weight is saved to the member's weight history and current weight, attendance is punched, one serving is deducted, achievements recalculate, and a notification is queued as today.
6. On **Reject**: nothing is recorded — no attendance, no deduction, no weight.

Staff-initiated check-ins from the Check-in page keep working exactly as they do now (immediate, with the existing weight box).

## Technical notes

- Migration:
  - `ALTER TABLE public.wellness_checkin_requests ADD COLUMN requested_weight numeric` (nullable).
  - `member_self_checkin(p_code text, p_weight numeric default null)` — stores the weight on the pending request; if a pending request already exists for today and a weight is supplied, update it. Keeps returning the same JSON shape.
  - `approve_checkin_request(p_request_id uuid, p_weight numeric default null)` — resolves the effective weight (`p_weight` override, else `requested_weight`); after a successful `checkin_member` call, inserts into `weight_tracking` (member, today, weight, `recorded_by = auth.uid()`) and updates `wellness_members.current_weight`. Weight failures must not roll back the attendance — wrap in an exception block that ignores errors and still returns `ok`.
  - Both keep `SECURITY DEFINER`, existing authorization checks, and authenticated-only execute grants.
- Frontend:
  - `useSelfCheckIn` takes `{ code, weight }`; `useApproveCheckIn` takes `{ requestId, weight }`.
  - `PortalCheckIn`: new pre-request step (weight input + submit) instead of auto-firing on scan; the QR deep link `?c=` also lands on this step rather than sending immediately. The post-approval weight box is removed since weight is now captured up front.
  - `PendingCheckInsCard`: show submitted weight, last recorded weight and delta, plus an editable weight input in the approve row.
  - `CheckInRequest` type gains `requested_weight`; pending query also selects the member's `current_weight`.
- No changes to staff check-in, plans, or serving maths beyond the above.
