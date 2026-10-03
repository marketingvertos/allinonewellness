# Family Day — monthly Weight Loss / Weight Gain reward card

## Goal
On the Family Day tab (Reports → Events), add a card that lists every member who lost **5 kg or more** (weight-loss members) or gained **3 kg or more** (weight-gain members) in a chosen calendar month, with the total kg they lost or gained.

## What you will see

- A new card on the Family Day tab, below the event card: **"Weight rewards — 5 kg loss / 3 kg gain"**.
- A **month drop-down** (January to December of the current year, plus any earlier months that have weight readings — e.g. September 2026). Default: the month you are viewing.
- Two clearly separated groups inside the card:
  - **Weight loss (5 kg or more)** — green heading, each member's name with the total kg lost that month (e.g. "Pawan Tripathi — 5.4 kg lost").
  - **Weight gain (3 kg or more)** — blue heading, each member's name with the total kg gained.
- Members are sorted biggest change first. An empty group says "No one qualified this month."
- A **Download** button exports the list (name, goal, kg lost/gained) as a file for the chosen month.

## How a member qualifies

- The card reads that member's weigh-ins for the chosen month (India time).
- Change = last weigh-in of the month − first weigh-in of the month.
- Weight-loss members qualify at 5 kg or more lost; weight-gain members at 3 kg or more gained — the same rule as the progress card in the member app, so both always agree.
- Members with fewer than 2 weigh-ins that month are not listed.

## Technical details

- New hook `useMonthlyWeightRewards(month)` in `src/hooks/useReports.ts`: queries `weight_tracking` for the month (paged), joins `wellness_members` (name, goal), computes first/last reading per member and net change, returns two sorted lists.
- New `WeightRewardsCard` component in `src/pages/WellnessReports.tsx`, rendered inside `EventTab` when `eventType === "family_day"`, with its own month `Select` (Jan–Dec of the current year plus any earlier months found in `weight_tracking`).
- Frontend only — no database changes. Uses the existing `downloadCsv` helper for export.

## Verification

- Typecheck + build.
- Sign in, open Reports → Events → Family Day, switch the card's month between September and October 2026, and confirm names and kg match the members' actual weigh-ins.
