# Offer card color and line-by-line descriptions

## What will change
- Add a color picker to the New offer / Edit offer form. Admins and coaches can choose one of the six existing high-contrast colors, shown as labeled swatches with a live card preview. The chosen color stays with that offer, rather than changing with the list of offers displayed.
- Use the chosen color consistently on the staff Offers page and the member's offer card: edge, icon, title, status, progress and qualification message. Existing offers receive a stable color so their appearance does not unexpectedly change; light and dark mode keep readable text.
- Replace the single description box with repeatable description lines: add another line, edit any line, remove a line, and reorder lines. Show each saved line separately on the member card, with its text wrapping naturally on small screens. Existing descriptions remain editable without losing text.
- Let coaches create and fully edit offers as requested, alongside admins/managers. Keep deleting offers restricted to admins/managers and leave member progress and reward rules unchanged.

## Technical details
- Add a nullable, validated `card_color` field to `wellness_promotions`, limited to the existing six theme palette names. Backfill existing offers with their current assigned color, and use a deterministic fallback for legacy rows. Keep theme tokens and all color-class mapping centralized in `src/lib/offerColors.ts`; do not store arbitrary visual CSS or hex codes in offer rows.
- Continue storing description in the existing text column. The editor turns newline-separated text into individual editable rows and joins them with newlines on save; the member display preserves those breaks. No separate description table is needed.
- Update the offer creation/editing permission checks and the database INSERT/UPDATE policies to allow authenticated staff coaches (`rep` role) in addition to managers/admins; keep DELETE restricted. Confirm grants still permit the intended actions.
- Verify saving and reopening a selected color and multi-line description, the resulting staff/member cards, coach authorization, and desktop/mobile plus light/dark readability. Check the preview build and relevant flows.
