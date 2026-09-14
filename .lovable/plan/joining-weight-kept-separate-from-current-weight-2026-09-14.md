# Joining weight kept separate from current weight

The registration form's question "Club Join करते समय आपका वजन कितना था?" is the weight at the time of joining the club. During the import it was copied into both the joining weight and the current weight of all 38 members who answered it.

## What changes

- The sheet value stays as each member's **joining weight** (the starting point for progress).
- **Current weight is cleared** for those 38 members. It stays blank until someone is weighed at the centre or records a weighing in the member app.
- Once a first weighing is recorded, progress is calculated from the joining weight to that reading, so the change shown is real rather than zero.

Nothing else about the members changes — names, contact details, health notes and logins stay as they are.

## Technical notes

- Data-only change on `wellness_members`: set `current_weight = NULL` where it currently equals `initial_weight` and no reading exists in `weight_tracking` (that table is empty, so all 38 qualify). No schema change.
- Member profile and portal already read `current_weight` with null handling and fall back to the latest `weight_tracking` entry, so blank values display as "—" rather than breaking the progress cards.
