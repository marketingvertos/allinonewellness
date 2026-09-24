# Instant pop-ups for check-in approvals and milestones

Staff screens will show a pop-up the moment something needs attention, on whatever page they are on.

## What staff will see
- **Check-in pop-up:** appears when a member scans the centre QR code. It shows the member's name and mobile, the weight they entered, their last weight and the change, and servings left. It has **Approve** and **Reject** buttons, and rejecting has an optional reason. After you act, it shows "Approved" or "Rejected" briefly and then closes. It stays on screen until you act or close it, even when you move to another page.
- **Milestone pop-up:** gold-styled, e.g. "Pawan Tripathi unlocked 5 kg Lost". It has a View profile button and a Dismiss button, and closes on its own after 15 seconds.
- **Layout:** pop-ups sit in the bottom-right corner (full width on phones), newest first. At most 3 show at once, with "+N more waiting" below.
- **Sound:** a short beep plays when a pop-up arrives. Browsers only allow sound after you've clicked somewhere on the page once; if sound is blocked, the pop-up still appears.
- **Who sees them:** team accounts only. Members never see them.
- **No duplicates:** if a check-in is approved on another device, the pop-up closes on this one too, so two staff never approve the same request.
- The Approvals tab on the Check-in page and the bell icon stay as they are.

## Technical details
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.member_achievements;` (check-in requests are already live). Existing staff-read policies decide which rows reach each screen.
- New `src/hooks/useRealtimeAlerts.ts`: one channel, set up in a `useEffect` and removed on unmount. It listens for INSERTs on `wellness_checkin_requests` where status is pending, UPDATEs to the same table (to close a pop-up once the request is no longer pending), and INSERTs on `member_achievements`. For each event it fetches the member, their active membership, the last weight and the achievement definition, then removes duplicates by id.
- New `src/components/wellness/RealtimeAlertStack.tsx`: reuses `useApproveCheckIn` and `useRejectCheckIn` and opens profiles through `MemberSheetById`. Uses semantic colours from the theme and plays a Web Audio beep, failing silently if audio is unavailable.
- `src/components/AppLayout.tsx`: mounts the stack only for staff.
