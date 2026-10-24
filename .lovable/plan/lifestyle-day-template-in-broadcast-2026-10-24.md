# Lifestyle Day template in Broadcast

## Finding
Meta already returns `lifestyle_day_25_oct_2026` as **APPROVED** (English, picture header), and the backend attaches the banner automatically. The Broadcast page was showing an older saved copy of the template list, and the new template sits deep in a long alphabetical list.

Quick workaround now: open WhatsApp → Broadcast and tap the refresh icon next to "1. Template". It will appear as "lifestyle_day_25_oct_2026 (en) — APPROVED".

## Fix
1. Broadcast page always fetches a fresh template list when opened (no stale copy).
2. Approved templates show first, newest first, so new event templates are at the top; pending/rejected ones go to the bottom.
3. Add a search box in the template dropdown.

## Technical details
- `useAllWhatsAppTemplates`: `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true`.
- `WhatsAppBroadcast.tsx`: sort templates by APPROVED first, then by Meta id descending; add a filter input above the select items.
