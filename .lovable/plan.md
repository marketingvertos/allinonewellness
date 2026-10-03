# Simplify the Attendance sheet export (Excel & PDF)

## Goal
Make the downloaded attendance sheet a clean report: member name, daily attendance marks with weights, and a few clear total columns — no clutter.

## What changes in the Excel and PDF download

1. **Remove columns:** Mobile, Mode, Status, Plan, Servings left, Join kg, Goal, Visits/Servings split.
2. **Keep columns, in this order:**
   - Sr.
   - Member (name only)
   - One column per day (P / A / S marks with the day's weight, as now)
   - Total Present
   - Total Absent
   - Latest Weight (kg)
   - Total Change (e.g. "10 kg loss" / "4.4 kg gain")
3. **Column sizing:**
   - Day columns stay narrow and compact.
   - Member name and the four total columns get wider spacing so every value is fully visible — no wrapped or cramped text.
4. **PDF page size:** the page is no longer forced into A4. For a month with 30 day-columns, the PDF uses a wider/longer custom page so all columns fit with proper gaps, one continuous table (no awkward column splits across pages).
5. The on-screen attendance grid stays as it is — this only changes the downloaded sheet.

## Technical details
- Edit `buildTable()` in `src/pages/WellnessAttendance.tsx` to emit the reduced column set.
- Pass column-width hints (narrow day columns, wide name/total columns) to `downloadXlsx` (`src/lib/reportExport.ts`) and `downloadBrandedPdf` (`src/lib/reportPdf.ts`); extend both helpers to accept per-column widths and a dynamic page size for the PDF.
- Verify by downloading both formats from the Attendance page while signed in and checking the output visually.
