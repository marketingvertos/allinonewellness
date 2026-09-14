# Import 39 members from the registration form

Load every row from the uploaded registration sheet into the member list, with a portal login for each person.

## What gets created

For each of the 39 people:

- Name, WhatsApp/mobile number, city is ignored (not stored today)
- Date of birth and anniversary date, cleaned into proper dates
- Height in centimetres (feet values converted, impossible values left blank)
- Starting weight and current weight set to the "weight when joining the club" figure
- Status: active member, goal: weight loss
- Joining date: the date their form was submitted
- Their health issues saved as a note on the profile
- A portal login using their mobile number with the default password Shri@@1008

## Data cleaning rules

- Mobile: strip spaces, commas and dots; if two numbers are given, keep the first 10-digit one. Rows with the same number are merged into one member (latest entry wins).
- Dates: handle all the formats present — `14041993`, `09.09.1981`, `05/06/1982`, `22/ aug/2002`, `5 October 1970`, `02/02/90`. Partial values (`2704`, `14 February`, `25th November`, `22/12/22` without a usable year) and the answers `No Answer`, `No`, `Unmarried` become blank. `31/06/2001` is not a real date, so that anniversary is left blank.
- Height: values under 8 are read as feet (5.7 → 173 cm, 5'5 → 165 cm, 5.2 → 158 cm); `5.2   157 cm` and `168 cm` read the centimetre figure; `6  7` read as 6 ft 7 is implausible for this record and is left blank, as are `16` and `12.9`.
- Weight: `92kg`, `100 kg`, `119.800` cleaned to numbers.
- Marital status set to married where a valid anniversary exists.
- Gender is not in the sheet, so it stays blank.

## Health notes

The health-issues answer is stored as a member note, except where the answer is `No`, `Nahi`, `Nil` or `No Answer`.

## Technical notes

- Rows inserted into `wellness_members` with `created_by` set to the admin account; notes into `member_notes`.
- Logins created through the existing `member-access` edge function (create action, default password), run once per member; any failures are reported back with the names so they can be retried.
- No schema changes.

## Verification

Count members in the list, spot-check a few cleaned records (Pawan Tripathi, Vinita Kathnawal, Shubha Agrawal, Akarsh Shah) and confirm logins were created for all.
