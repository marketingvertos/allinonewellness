# Attendance: weight reading on present days + PDF and Excel download

## What you will see
- **Daily view:** each name in the Present list shows that day's weight and the total change since joining, for example "72.4 kg · 3.6 kg lost" (green) or "1.2 kg gained". If no weight was recorded that day, it shows the latest weight before that day with "(last: 01 Oct)". If the member has never been weighed, it shows "No reading".
- **Weekly / Monthly / Custom register:** each present cell shows the tick plus that day's weight in small text below it. Days without a weighing show only the tick. Each row ends with new columns: **Latest weight** and **Total change** (loss or gain, with colour).
- **Downloads:** the single Export button becomes two buttons, **Excel** and **PDF**.
  - Excel: Sr., Member, Mobile, Mode, Plan, Servings left, Joining weight, one column per day ("P 72.4", "P", "S" or "A"), then Present, Absent, %, Latest weight, Total change (kg, with "Loss" or "Gain").
  - PDF: the same table on A4 landscape with the club's branded header, page numbers and IST generation time, matching the Club Reports PDFs. Long ranges continue across pages and the header repeats.
- **Total change** is worked out against the member's goal: loss for weight-loss members, gain for weight-gain members. It is measured from the joining weight to the latest reading on or before that day.

## Where the readings come from
- The weight recorded when a check-in is approved, plus any weight readings staff add in the member's Progress tab, matched by date. If a member is weighed twice in one day, the later reading is used.
- Nothing new is stored and no database changes are needed.

## Technical details
- `useAttendanceRegister` (in `src/hooks/useWellness.ts`): also select `initial_weight, goal` from members, and page through `weight_tracking` (member_id, recorded_date, weight, created_at) up to `to`. Build per-member `weightByDate` (in the range) and `latestWeight` / `totalChange` as of `to`. Add `initialWeight`, `goal`, `weightByDate`, `latestWeight`, `totalChange` to `AttendanceRow`. For the Daily view, the reading is the latest on or before the selected day.
- `src/pages/WellnessAttendance.tsx`: show readings in the lists and grid cells, and add the two end columns. Replace the CSV export with `downloadXlsx` (existing `src/lib/reportExport.ts`) and `downloadBrandedPdf` (existing `src/lib/reportPdf.ts`, landscape). Files are named `AIOW-Attendance-<view>-<from>-to-<to>.xlsx/.pdf`.
