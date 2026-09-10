# Master Title — Referral Network & Progressive Recognition

Every member's referral network is counted in two layers: **Frontline** (people they referred directly) and **Cluster** (everyone referred further down the chain). The combined total earns a Master title at 10, 20, 30, 40, 50 and 100 — always the highest milestone passed, so 25 people is Master 20.

## What gets built

**Network counting in the backend**

Each member record starts carrying four live numbers — frontline, cluster, total and master level — kept up to date automatically whenever anyone's referrer is set or changed. Existing members are counted once at setup, so the titles are correct from day one. A separate lookup returns the full tree for one member when the network view is opened.

**Network tab on the member profile**

A new "Network" tab next to Overview, Plan, Attendance and the rest, showing:
- A Master title card with a star (crown at Master 100), the three counts as tiles, and a progress bar toward the next level ("Master 30 — 10 more needed"). Members under 10 see "10 network members needed for Master 10".
- The network grouped by level: Frontline first, then Level 2, Level 3 and so on, each person grouped under whoever referred them, with their status and — for frontline people — how many sit under them. Names open that person's profile.
- A Tree / List switch, with a search box on the flat list for large networks.

The Master badge also appears beside the member's name in the profile header.

**Dashboard**

The Top referrers card becomes "Top referrers & Master titles": each person shows their Master badge, Frontline · Cluster · Total, and a hint like "6 more for Master 10" for those not there yet. Ranking switches from direct referrals to total network size.

**Members list, check-in and export**

A small amber Master badge on member rows and on check-in search results. The CSV download gains Frontline, Cluster, Network total and Master level columns.

**Member portal**

A "My Network" card on the portal home with the member's Master title, counts and progress bar, plus a "View my network" link to a new read-only network page at `/portal/network` showing their frontline and cluster (names and level only).

**Look**

Amber/gold throughout for Master elements — one star for Master 10–30, two for 40–50, a crown for 100 — expressed through the existing theme tokens so light and dark both work.

## Technical notes

- Migration on `public.wellness_members`: add `frontline_count`, `cluster_count`, `network_total`, `master_level` (all `integer not null default 0`), plus `AFTER INSERT OR UPDATE OF referred_by_member_id` trigger `trg_refresh_network_counts` calling a `SECURITY DEFINER plpgsql` function that walks each affected ancestor chain (old and new referrer) and recomputes counts with a recursive CTE capped at depth 20. Existing rows backfilled in the same migration. The function must be `SECURITY DEFINER` with `set search_path = public` so its `UPDATE` is not blocked by RLS, and it must not trip `guard_member_self_update` — that guard will be checked and its allowed-column list widened if it rejects these system-written columns.
- Two `STABLE` SQL RPCs as specified in the brief: `get_referral_network(root_member_id uuid)` returning `member_id, full_name, mobile_number, status, depth, referred_by`, and `get_network_summary(member_ids uuid[])` returning per-root counts and master level. Both run as invoker so RLS still applies; `EXECUTE` granted to `authenticated`.
- `src/hooks/useWellness.ts`: extend `WellnessMember` with the four fields; add `useReferralNetwork(memberId)`, `useNetworkSummary(memberIds)`, `MASTER_LEVELS`, `getMasterTitle`, `getNextMasterLevel`; invalidate `referral-network` / `network-summary` keys after member create/update.
- New `src/components/wellness/MasterTitleBadge.tsx` (badge + icon tier) and `src/components/wellness/NetworkPanel.tsx` (title card, grouped tree, flat list, shared between profile tab and portal page).
- Edits: `MemberDetailSheet.tsx` (tab + header badge), `WellnessDashboard.tsx` (top referrers card), `WellnessMembers.tsx` (row badge + CSV), `WellnessCheckIn.tsx` (search row badge), `PortalHome.tsx` (My Network card), new `src/pages/portal/PortalNetwork.tsx`, route in `App.tsx`.
- Referrer picker excludes anyone in the member's own downstream network so a loop cannot be created.
- Supabase types regenerate after the migration; hooks land afterwards.
