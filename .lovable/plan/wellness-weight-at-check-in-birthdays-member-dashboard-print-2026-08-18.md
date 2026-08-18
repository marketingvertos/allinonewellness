# Wellness: weight at check-in, birthdays, member dashboard, printable QR

## 1. Weight capture during check-in

- On the staff **Check-in** page, each member row gets an inline weight field (kg, optional). Entering a value records the visit and logs the weight for today in one action.
- If a member is already checked in today, staff can still log/update today's weight from the same row.
- The member detail dashboard shows the latest weight, change since joining, and change since last reading.
- Member portal check-in screen gets an optional "Log today's weight" input after a successful scan, so self check-ins stay tracked too.

## 2. Date of birth and relationship management

- Date of birth added to the Add Member form and editable from the member profile.
- Members list shows a birthday indicator for anyone with a birthday in the next 7 days.
- Wellness overview gets an **Upcoming birthdays (next 30 days)** card listing name, date, age turning, and a one-tap WhatsApp wish link using their mobile number.
- Member profile header shows age and birthday.

## 3. Modern member profile dashboard

Rework the member detail sheet into a wider dashboard-style panel:

- **Header strip**: photo-less avatar initials, name, status, plan badge, age, joined date, activation code.
- **KPI tiles**: current weight, total change (kg + %), BMI (with category), servings remaining / total, attendance this month, days left on plan.
- **Goal progress bar**: start weight -> current -> target, with percent of goal achieved.
- **Weight trend chart**: line/area chart of all weight entries (recharts, already available via shadcn chart).
- **Body composition bars**: waist / hip / chest / body-fat from the existing measurements table, latest vs first, with a bar chart; plus a form to record a new measurement set.
- **Attendance bar chart**: visits per week for the last 8 weeks.
- **Servings donut/progress**: used vs remaining, with the ledger below.
- Existing tabs (Plan, Attendance, Progress, Notes) stay, but the Overview tab becomes this dashboard.

## 4. Check-in QR code — make it findable and printable

- New **Wellness > Check-in QR** page at `/wellness/qr` (sidebar entry) showing the large centre QR, the URL, rotate-code button, and a **Print poster** action.
- Print poster renders a clean A4 layout: centre name, "Scan to mark attendance", large QR, short instructions in English + Hindi, and nothing else (print-only stylesheet).
- Download PNG option so it can be shared or printed elsewhere.
- Quick link buttons from the Wellness overview and the Check-in page to this QR page.
- Scanning still routes to `/portal/checkin?c=<code>`: the member signs in once, attendance is recorded and one serving auto-deducted; members can only check in, nothing else.

## Technical notes

- Migration: add `date_of_birth` usage (column already exists) — no schema change needed for DOB; add nothing new for weight (uses `weight_tracking`) or measurements (uses `body_measurements`).
- New RPC not required: check-in + weight are two calls wrapped in one mutation with cache invalidation.
- New hooks in `useWellness.ts`: `useUpcomingBirthdays`, `useBodyMeasurements`, `useAddBodyMeasurement`, `useUpdateMember`, `useCheckInWithWeight`.
- Charts use `recharts` via the existing `components/ui/chart` wrapper and semantic design tokens only.
- New files: `src/pages/WellnessQr.tsx`, `src/components/wellness/MemberDashboard.tsx`, `src/components/wellness/BirthdaysCard.tsx`, `src/components/wellness/RecordMeasurementDialog.tsx`.
