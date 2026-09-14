# Fuller public registration form

Bring the public `/join` form in line with what the team captures when adding a member by hand — minus the tags and batch, which stay a team-only decision.

## What changes on the form

Current fields: full name, WhatsApp number, alternate mobile, date of birth, anniversary, city, height, joining weight, health issues.

Added / changed:

- **Relationship status** — Single / Married / Prefer not to say.
- **Anniversary date** — only appears once "Married" is chosen (today it is always shown).
- **Email ID** — optional, validated as a real email.
- **Gender** — Female / Male / Other.
- **Member type** — Physical / Virtual (same choice the team makes).
- **Wellness goal** — same seven options the team uses (weight loss, fat loss, weight management, weight gain, general wellness, healthy lifestyle, body transformation); defaults to weight loss.
- **Target weight (kg)** — optional.
- **Who introduced you? (optional)** — free text, saved into the joining note so the team can link the right referrer later.

Field order becomes: name, WhatsApp, alternate mobile, email, gender, date of birth, relationship status, anniversary (conditional), city, member type, goal, height, joining weight, target weight, who introduced you, health issues, consent line.

Required stays the same: name and WhatsApp number only.

## What gets saved

The new lead record stores email, gender, relationship status, anniversary (only when married), member type, goal and target weight alongside what it already saves. Joining weight still becomes the starting weight and current weight stays blank until the person is actually weighed. City, alternate number, referrer name and health issues continue to go into the member's first note.

## Technical notes

- `src/pages/PublicRegister.tsx`: add `email`, `gender`, `marital_status`, `member_mode`, `goal`, `target_weight`, `referrer_name` to form state; use shadcn `Select` for gender / status / goal and `ToggleGroup` for member type, matching `CreateMemberDialog`; render the anniversary `DobInput` only when `marital_status === "married"` and clear the value when the status changes away from married.
- `supabase/functions/public-register/index.ts`: extend the zod schema with `email` (optional email, max 255), `gender` and `marital_status` enums, `member_mode` enum (`physical` | `virtual`, default `physical`), `goal` enum matching the `wellness_goal` type (default `weight_loss`), `target_weight` optional number (20–300), `referrer_name` optional text (100). Insert those onto `wellness_members`; force `anniversary_date` to null unless `marital_status === "married"`; append `Introduced by: …` to the note lines.
- No database changes — every column already exists on `wellness_members`.
