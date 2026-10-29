# Clickable "Who introduced whom" report

## What changes
1. **Every number opens a list**
   - Top tiles (New people, By coaches, By club members, By outside people, Not recorded) open a list of exactly those people.
   - In the table, the Introduced, Paid trial, White Card and Gold UMS numbers each open a list of that introducer's people, filtered to that column (for example, Shri Chatap → 6 introduced, or only his 3 Gold UMS).
   - Numbers look like links (underlined, pointer cursor) so it's obvious they can be tapped. Zero values are not clickable.

2. **Detail list for each person**
   Name, mobile, joining date, current plan, status, who introduced them and type. Tapping a name opens their member profile. Each list has a search box and its own Excel download.

3. **Fixing "Not recorded" (the 14)**
   The Not recorded list shows each person with a **Set introducer** button. It opens the same "Who introduced you?" picker used on the profile (club member or someone else). After saving, the person moves to the correct row and the counts update right away.

## Technical details
- Frontend only, in `src/components/wellness/reports/IntroducerReport.tsx`; data already comes per person from `get_introducer_report`, so no database change.
- One generic drill-down state `{ title, people }` replaces the current single-introducer dialog.
- Reuse the existing shared introducer editor component for "Set introducer", then invalidate the `introducer-report` query.
- Profile link uses the existing member detail navigation instead of `/members?q=`.
