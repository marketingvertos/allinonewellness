# Membership card (UMS) PDF — premium redesign + tiny file size

## What I found in your card
- **File is 3.9 MB because of the logo.** The logo is put into the PDF at full 1000×1000 size, uncompressed (2.9 MB picture + 1 MB transparency layer). Text and table are only a few KB.
- **Rupee sign is broken.** "₹7,500" prints as "¹7,500" because the PDF's built-in font has no ₹ symbol.
- **Layout feels loose:** labels and values don't line up in clean columns, the body-result boxes show "—" floating far right, the history table has uneven column widths, and the bottom half of the card is empty yellow.
- All data sits directly on yellow, which hurts readability.

## New design — "Yellow Card"
```text
+-----------------------------------+  <- yellow outer frame (4 mm border)
| [logo] UNIVERSAL MEMBERSHIP CARD  |  <- deep teal header band
|        All In One Wellness · Yellow Card
| +-------------------------------+ |
| | Pawan Tripathi        ACTIVE  | |  <- white panel, rounded corners
| | Reg. No 9DCE35 · Physical     | |
| |-------------------------------| |
| | Joined      | Date of birth   | |  <- 2-column grid, fixed label
| | Anniversary | Coach / mobile  | |     column widths, aligned baselines
| +-------------------------------+ |
| | NEW Gold Card UMS  | 12 left  | |  <- teal plan strip, servings big
| +-------------------------------+ |
| | TARGET RESULT  (3 x 2 tiles,  | |  <- label on top, value centred
| |  white tiles, thin grey line) | |
| +-------------------------------+ |
| | PLAN & PAYMENT HISTORY table  | |  <- teal header, light zebra rows,
| |  #  Date   Plan      Amount   | |     fixed widths, "Rs 7,500"
| +-------------------------------+ |
|  Generated 25 Oct 2026 IST · 1/1  |  <- footer on yellow frame
+-----------------------------------+
```
- Yellow stays only as the frame/branding; every piece of data is on white.
- Consistent type scale: small grey caps labels, bold dark values, one teal accent, one gold accent line under section titles.
- Fixed grid with equal row heights so everything lines up in rows and columns.
- Amounts shown as "Rs 7,500" (or "Free") so they always print correctly.
- Card height still A6; long histories continue on a second page with the same frame.

## File size
- Shrink the logo to about 200 px and embed it as a small compressed image, plus turn on PDF compression.
- Target: **under 60 KB** per card (expected ~20–40 KB).

## Technical details
- Only `src/lib/membershipCardPdf.ts` changes.
- `loadLogo()`: draw the logo onto a canvas at ~200 px, export as compressed PNG data URL (keeps transparency, tiny); cache it in memory.
- `new jsPDF({ ..., compress: true })`; `addImage(..., "FAST")` alias reused across pages.
- Replace "₹" with "Rs " in `rupees()`; rebuild layout with helper functions for panel, field grid, tiles; autoTable with fixed `columnStyles` widths, white body, light zebra.
- Verify by generating a sample card locally, rendering it to an image, and checking the file size.
