# Club Reports — Branded redesign + one-click PDF download

## What changes for you
- The "PDF" button on each tab becomes **Download PDF**. One tap saves the file straight to your device — no print window, no pop-up.
- File names are clear and dated:
  - `AIOW-Daily-Register-September-2026.pdf`
  - `AIOW-Weekly-Summary-September-2026.pdf`
  - `AIOW-Monthly-Record-September-2026.pdf`
- Every PDF has a branded header (club logo, "All In One Wellness", report name, month, generated date/time in IST), green header/totals rows, gold section titles, and a footer with page numbers.
- Daily and Weekly PDFs are A4 landscape and fit **all columns** (15D/30D UMS, payment modes, milk, retail) — nothing cut off. Monthly is A4 portrait, grouped into Operations / Finance / Manual entries.
- Empty days show "–" instead of rows of zeros, both on screen and in the PDF.
- On screen (from the brief): summary cards at the top of each tab, zebra rows, sticky first column, numbers right-aligned, editable cells marked with a dashed underline + pencil. Excel download stays as it is (renamed files to match the PDF style).

## Technical details
- Add `jspdf` + `jspdf-autotable`; new `src/lib/reportPdf.ts` builds the PDF directly from the report data (not a screenshot), draws the logo from the existing brand asset, applies theme colors, auto-fits font size to column count, repeats headers per page, adds page-number footer, then calls `doc.save(filename)`.
- `ClubReports.tsx`: replace `printReport` calls with `downloadClubPdf({ kind, month, rows, totals })`; show a short "Preparing PDF…" button state; zero-to-dash formatter; KPI cards; restyled tables with `report-table` classes.
- Add a `@media print` fallback in `index.css` hiding the app shell, in case someone uses the browser's own print.
- No database changes.
