# Offers, Qualifications & Promotions

Members see live offers on their app home screen with their own progress. The team creates and manages offers from a new **Offers** page and marks rewards as given.

## Three offer types
- **Referral Challenge** (short term, e.g. "Introduce 5 new members in October, get membership FREE") — progress bar, auto-counted.
- **Qualification Journey** (long term, e.g. "Help 15 people join, earn a 3N/4D National Vacation") — same auto-counting, premium reward.
- **Announcement** (e.g. "1–3 Oct: bring a guest, they get a 3-day free trial") — banner only, no progress.

## What counts as progress (chosen per offer)
- **New referrals** — people this member referred who joined inside the offer dates (leads and inactive people don't count).
- **New memberships** — memberships bought by people this member referred inside the offer dates.
- **Attendance days** — this member's own attendance days inside the offer dates (packed-serving days count).

All dates use India time.

## Team side — new "Offers" page (sidebar, Members group)
- Tabs: Active / Expired / All.
- Each offer card: icon, title, type and dates, target, reward, "X participating · Y qualified", buttons View progress, Edit, Deactivate/Activate.
- Create/Edit form: type, title, description, reward, optional banner line, emoji icon, what counts, target number, start and end dates, show to All / Physical / Virtual.
- View progress: list of members with count, bar, Qualified badge; search; **Mark reward given** with optional note (shows date and staff); CSV export. Opening the list refreshes everyone's counts.
- Only admins and managers can create or edit; other team members can view.

## Member side — app home
- Offer cards right after "My plan": gold for challenges/qualifications, blue for announcements, green celebration when qualified ("Your coach will give you the reward" then "Reward received" once marked).
- Only offers running today and matching the member's Physical/Virtual mode. Counts refresh each time the home screen opens.
- Members can only see their own progress.

## Example offers
I'll add the three examples from your guide (Free membership October challenge, National Vacation Jul–Dec, Free Trial Weekend 1–3 Oct) so you can see them straight away — you can edit or delete them.

## Changes from the guide
- Your menu has no "Engagement" group, so Offers goes under **Members** next to Achievements.
- Access checks use the existing team-role checks rather than the guide's direct role lookups (safer, matches the rest of the app).
- Members can only refresh their own progress; the team can refresh anyone's.
- Offer icons in the guide's example colours will use the app's theme colours so dark mode works.

## Technical details
- Migration: `wellness_promotions` and `wellness_promotion_progress` (unique promotion_id+member_id), GRANTs to authenticated/service_role, RLS: select for authenticated (members: active & in-date promos; own progress via `owns_wellness_member`; staff via `is_wellness_staff`), write via `is_wellness_manager`; updated_at triggers; validation trigger for offer_type/target_metric/visibility values and end_date >= start_date.
- RPC `calc_promotion_progress(p_promotion_id, p_member_id)` SECURITY DEFINER, guarded (staff or owner), IST bounds, upserts progress, keeps first qualified_at. RPC `calc_promotion_progress_all(p_promotion_id)` (staff) recalculates for every member with referrals/attendance in range. RPC `mark_promotion_reward(p_progress_id, p_claimed, p_note)` (manager).
- New `src/hooks/usePromotions.ts`, `src/pages/WellnessPromotions.tsx`, `CreatePromotionDialog.tsx`, `PromotionProgressSheet.tsx`, `src/components/portal/PromotionCards.tsx`; edits to `PortalHome.tsx`, `App.tsx` (`/promotions`), `AppSidebar.tsx` (Gift icon).
- Example offers inserted as data, not in the migration.
- Test live: create an offer, open progress, mark a reward, and view the member app home.
