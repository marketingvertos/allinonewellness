# High-Contrast Offer Colors

## Problem
Offer cards (member portal home + staff Offers page) barely show their assigned color:
- Card background tint is 5% — nearly invisible.
- Icon chip background is 15% with default text color.
- Only the thin left border and progress bar carry full color.

## Change — keep each offer's distinct hue, make it unmistakable
All styling stays centralized in `src/lib/offerColors.ts` so staff and member cards stay consistent (per project rule).

1. **`src/index.css` + `tailwind.config.ts`**: add one high-contrast foreground token per offer color (`--offer-*-fg`) — a dark, near-black tone in light mode (sits on saturated color) and a matching readable tone in dark mode. Used for text placed on solid offer color.

2. **`src/lib/offerColors.ts`** — new per-color class sets:
   - Card: `border-l-8` (thicker color edge) + stronger tint background (`bg-offer-X/15` instead of /5).
   - Icon chip: **solid** `bg-offer-X` with icon/text in `text-offer-X-fg` — the strongest visual anchor.
   - New `title` class: offer-card title text in full offer color for instant differentiation.
   - New `badge` class: solid offer-colored badge (e.g. "Live" / validity) with fg text.
   - Progress bar: unchanged full offer color.
   - Colors: same six hues (teal, coral, blue, gold, green, plum) — only intensity changes, so assignments don't shuffle.

3. **`src/components/portal/PromotionCards.tsx`** and **`src/pages/WellnessPromotions.tsx`**: apply the new title/badge classes; the qualification banner on member cards uses solid offer color with fg text instead of `bg-primary/10`.

## Verification
- Typecheck, then Playwright on the portal home and the staff Offers page (light mode) to confirm cards are clearly color-differentiated and text is readable; check dark mode via token swap.
