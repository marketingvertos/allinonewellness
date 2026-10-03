# Make the online payment screen easier to tap on mobile

## Problem
In the member app, the "Pay online" window is hard to operate on phones:
- The plan chooser is a small drop-down with tiny tap area and truncated plan names.
- The Pink Card credit toggle is a small switch, not the whole row.
- The action buttons at the bottom don't invite a confident tap compared with the rest of the app.

## What to change
All changes are in `src/components/wellness/PayOnlineDialog.tsx` (used by the member portal's "Renew online" / "Pay online" button). No backend or data changes.

1. **Plan chooser → big tappable cards.** Replace the drop-down with a vertical list of full-width plan cards (minimum 56px tall). Each card shows the plan name, price and servings ("30 servings + 2 bonus"), with the selected plan highlighted. Tapping anywhere on a card selects it. On desktop the same list renders as a clean picker; no drop-down anywhere.

2. **Pink Card credit → whole row tappable.** The "Use Pink Card credit" row becomes a single large tap target that toggles the switch; the switch itself stays as a visual indicator. Rows get taller padding so they are easy to hit.

3. **Primary pay button → larger and sticky.** The "Pay ₹X" button becomes a taller (h-12) full-width primary button in the sticky bottom bar. While it is working it shows a spinner and "Opening…" so it is obvious a tap registered. "Cancel" moves to a secondary (outline) button below it; the close ✕ in the header also closes, so a mistaken tap never loses progress.

4. **Amount summary → clearer.** Bigger text for "To pay now", with the plan amount and Pink Card discount above it in a simple readable stack.

## Verification
- Sign in as a member on the phone-size preview, open "Renew online", tap a plan card, toggle Pink Card credit (where available) and confirm the pay button is comfortably tappable and shows the loading state.
- Typecheck must pass; build log clean.
