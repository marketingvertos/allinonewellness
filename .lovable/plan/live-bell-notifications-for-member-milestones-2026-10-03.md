# Live bell notifications for member milestones

The bell icon at the top of every staff screen will light up the moment a member reaches something worth celebrating. Clicking a notification opens the right place to see it.

## What triggers a notification
- **Milestone unlocked** (e.g. "5 kg Lost") — opens the member's profile.
- **Consistency reward** earned for the month — opens Reports, Family Day tab.
- **5 kg lost / 3 kg gained in a calendar month** — sent once per member per month, as soon as a weigh-in crosses the line. Opens Reports, Family Day tab, on that month.
- **New title**: Ambassador, Supervisor, or a Master level (Master 10, 20 ...) — opens the member's profile.
- **Birthday today** — sent each morning. Opens the member's profile.

## Who gets them
Every admin, manager and team account. Members never see them. Each event is sent only once, so there are no repeats.

## Bell behaviour
- The red count updates instantly with no page refresh, and a short beep plays.
- Each item has an icon for its type (trophy, scale, star, cake), the member's name and the time.
- Clicking marks it read and opens the right page. "Mark all read" stays.

## Technical details
- New security-definer `notify_staff(p_type, p_title, p_message, p_ref_id, p_ref_type, p_dedupe_key)` inserts one `notifications` row per user with an admin/manager/staff role. A new `dedupe_key` column with a unique index on (user_id, dedupe_key) stops repeats.
- Triggers:
  - `member_achievements` INSERT → milestone (`reference_type='member'`).
  - `wellness_monthly_rewards` INSERT → consistency reward (`reference_type='reward'`, month in the message).
  - `weight_tracking` INSERT/UPDATE → work out the month's first and last weigh-ins. Fire when loss is at least 5 kg (weight-loss goal) or gain is at least 3 kg (weight-gain goal). Dedupe key is `weight:<member>:<month>`.
  - `wellness_members` UPDATE on `master_level` increase or `tags` gaining supervisor/ambassador → title notification.
- Birthdays: extend the existing daily birthday job to call `notify_staff`, with dedupe key `bday:<member>:<date>`.
- Add `notifications` to the realtime publication if it isn't already there.
- `NotificationCenter.tsx`: type icons, beep on new unread items, routing. Members open via `MemberSheetById`. Rewards and weight go to `/reports?tab=events&sub=family-day&month=YYYY-MM`. The Reports page reads those settings when it opens.
