# Body Evaluation upgrade

Today the centre can only record waist, hip, chest and body fat. This upgrade turns that into a full Body Evaluation matching the printed green report card.

## What changes for the team

**New Body Evaluation form** (replaces "Record body measurements")

Grouped into four sections, every field optional except the date:
- Basic — Weight, BMI (fills itself from height and weight, still editable), Ideal Weight (fills itself from height and gender, still editable), with a live "5.2 kg over ideal weight" line. Height is shown read-only from the profile.
- Body Composition — Trunk Fat, Muscle Mass, Body Fat %, Visceral Fat, each with a live Normal / High / Risk badge that updates as you type. Muscle mass ranges follow the member's gender (male ranges if gender isn't set).
- Metabolic — BMR and Body Age, with the member's real age beside it and "2 yrs younger" / "3 yrs older".
- Physical Measurements — Waist, Hip, Chest.
- Notes — a Remark line for the evaluator.

**Member profile**
- The section is renamed "Body Evaluation" and the button becomes "New Evaluation".
- Each past entry lists every recorded reading (weight, BMI, TSF, MM, fat %, VF, BMR, body age, waist/hip/chest) plus the remark.
- A new "Latest Body Evaluation" card on the member's dashboard shows the most recent readings with their health-range badges, ideal weight and over/under figure.
- The body composition chart widens to include trunk fat, muscle mass, visceral fat and BMI alongside the existing measurements.
- BMI wording switches to the Indian categories used on the printed card: Malnutrition, Malnutrition 1, Normal, Overweight, Obesity Grade 1/2/3.

**Member portal**
- Members see a read-only "Body Evaluation" card with their latest BMI, body fat, muscle mass, visceral fat, BMR, body age and the evaluator's remark.

**Printing**
- A "Print report" button on the latest evaluation opens a print-friendly card laid out like the physical green card (centre name, member details, parameter/Normal/High/Risk table, BMI table, ideal weight and remark).

Old records stay exactly as they are; missing new readings simply don't appear.

## Technical notes

- Migration on `public.body_measurements`: add nullable `weight`, `trunk_fat`, `muscle_mass`, `visceral_fat`, `bmr`, `bmi`, `ideal_weight` (numeric), `body_age` (integer), `remark` (text). No drops, existing RLS and grants untouched; types regenerate afterwards.
- New `src/components/wellness/bodyEvalConstants.ts` — `BODY_EVAL_RANGES` (trunk fat, muscle mass with male/female sets, visceral fat, BMI) plus a `getRange(param, value, gender)` helper returning label and token-based colour class.
- `src/hooks/useWellness.ts` — extend the `BodyMeasurement` interface with the nine fields and switch `useBodyMeasurements` to `select("*")`.
- `RecordMeasurementDialog.tsx` — rewritten as the sectioned form; accepts `memberHeight` and `memberGender`; BMI from `w / (h/100)^2`, ideal weight from the Devine variant (male `50 + 0.91*(h-152.4)`, female `45.5 + 0.91*(h-152.4)`); submit and edit-mode hydration cover all fields.
- `MemberDetailSheet.tsx` — passes height/gender, renames the section, richer entry rows.
- `MemberDashboard.tsx` — expanded `compositionData`, new latest-evaluation card, Indian `bmiCategory()`, prefers stored `bmi` over the calculated one.
- `PortalHome.tsx` — uses `useBodyMeasurements(identity.memberId)` for the read-only card.
- New `BodyEvalPrintCard.tsx` with an `@media print` container.
- All colours via existing semantic tokens, `sm:grid-cols-2` grid so the form stays usable on mobile.
