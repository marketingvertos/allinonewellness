# Referral, Achievement & Badge System (Wellness)

Adds three gamified achievement categories to member profiles: Community (referrals/Ambassador titles), Weight Loss milestones, and Weight Gain milestones — all driven by configurable milestone data, not hard-coded values.

## 1. Referrals ("Helped By")

- Members gain a `referred_by_member_id` link to another member.
- The Add Member form gets an optional searchable "Referred By / Helped By" picker that searches existing members by name, mobile number or member code. Only real, non-inactive members are selectable.
- Rules enforced in the database: no self-referral, one direct referrer per member, no cycles (A refers B, B cannot refer A).
- Staff can also set or change the referrer later from the member profile.
- Direct referrals only in v1 (a referral by your referral does not count for you). Structure keeps multi-level possible later.

## 2. Ambassador titles

Configurable referral milestones, seeded with the brief's ladder:
Ambassador 2, Silver 5, Gold 7, Platinum 10, VIP Platinum 15, Elite Platinum 20, Ruby 30, Topaz 40, Emerald 50, Sapphire 60, Diamond 75, Crown 100.

Profile shows: People Helped count, current title, progress bar to next title, "help N more people to unlock X", and a list of people directly helped (name, joining date, status). At the top rung it shows the congratulations state instead of a next target.

## 3. Health milestones

- Weight Loss milestones seeded at 5/10/15/20/25 kg lost; Weight Gain at 3/6/9/12/15 kg gained.
- Total lost = starting weight − current weight; total gained = current weight − starting weight. Starting weight comes from the member's initial weight (falling back to the earliest recorded weight), current weight from the latest weight record.
- Which ladder shows depends on the member's goal: weight-loss-type goals show the loss journey, weight-gain goals show the gain journey. Members with neither see only the community card.
- Unlocked milestones are stored permanently, so a temporary weight swing never removes an earned badge.

## 4. Achievements UI

New "Achievements" tab on the member profile sheet (staff) and an Achievements section in the member portal home, both using the same component:
- Community card: title badge, people helped, progress bar, next target, referred-people list.
- Health card: starting/current weight, total lost or gained, unlocked/locked badge grid, next milestone with kg remaining and a progress bar.

## 5. Admin configuration

New page under Wellness: **Achievement Settings** (managers/admins only) with three tabs (Referral, Weight Loss, Weight Gain). Managers can add, edit, reorder, activate/deactivate milestones and pick an emoji/icon for each badge. Changing thresholds recalculates who qualifies; already-unlocked history is preserved.

## Technical notes

Database (one migration):
- `wellness_members.referred_by_member_id uuid` + index, with a `BEFORE INSERT/UPDATE` trigger blocking self-reference and 2-cycles.
- `achievement_definitions` (category `referral|weight_loss|weight_gain`, name, threshold numeric, unit, icon, sort_order, is_active) — read by all authenticated users, written by managers. Seeded with the ladders above.
- `member_achievements` (member_id, achievement_id, unlocked_at) with a unique pair constraint so re-runs never duplicate.
- `recalc_member_achievements(p_member_id uuid)` security-definer function: computes direct referral count and weight delta, inserts any newly crossed active milestones (`ON CONFLICT DO NOTHING`). Called by triggers on member insert/update (referrer, goal, initial weight) and on `weight_tracking` insert, plus after milestone-config changes.
- Grants + RLS on both new tables: staff read all, members read their own rows.

Frontend:
- `useWellness.ts`: hooks for referral list, achievement definitions + CRUD, member achievements, and a derived `useMemberAchievements(memberId)` that returns current/next milestone per category.
- New `src/components/wellness/AchievementsPanel.tsx` (shared by staff sheet and portal), `ReferrerPicker.tsx` (command-based search), and `src/pages/WellnessAchievements.tsx` for admin settings; route + sidebar entry added.
- Existing weight-recording flows stay unchanged; recalculation happens server-side.
