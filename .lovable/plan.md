# Expand Master titles from network totals

Keep Frontline (direct referrals), Cluster (indirect referrals), and Network Total counting exactly as they are. Change only the Master title ladder and its display.

## New title ladder

| Network total | Title | Symbol |
| --- | --- | --- |
| 0–9 | No Master title | None |
| 10–14 | Master 10 | One amber star |
| 15–19 | Master 15 | One amber star |
| 20–29 | Master 20 | One amber star |
| 30–39 | Master 30 | One amber star |
| 40–49 | Master 40 | Two amber stars |
| 50–59 | Master 50 | Two amber stars |
| 60–69 | Master 60 | Two amber stars |
| 70–79 | Master 70 | Two amber stars |
| 80–89 | Master 80 | Two amber stars |
| 90–99 | Master 90 | Two amber stars |
| 100+ | Master 100 | Crown |

## Implementation

- Update the saved Master level calculation and network-summary lookup to use the same ladder. Recalculate saved titles for existing members without changing their Frontline, Cluster, or Network Total counts. Future referral edits should automatically use the new ladder.
- Update the app's current-title and next-title calculation so the network progress bar and “more needed” messages advance through 15, 60, 70, 80, and 90 as appropriate.
- Keep one amber star below 40, two from 40 through 99, and the existing crown at 100+. Preserve the current title placements in profiles, member lists, check-in, dashboard, and member portal.
- Check threshold boundaries, especially 14→15, 59→60, 69→70, 99→100, and the existing 74-member network, which should display Master 70. Verify staff and member views where access permits.

## Technical notes

The database currently computes Master levels separately in `recalc_network_counts` and `get_network_summary`; the app also has its own `MASTER_LEVELS` list. Apply an additive migration to replace the two function definitions and refresh stored `master_level` values. Do not edit old migrations. Do not change the separate referral achievement badges or Coach titles, which follow different rules.
