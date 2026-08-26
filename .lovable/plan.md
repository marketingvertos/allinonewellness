# Wellness module: mobile-first UI/UX pass + end-to-end fixes

Goal: make every Wellness screen (staff side and member portal) feel designed for a 360px phone, not squeezed from desktop — and verify the full flow (login, member creation, check-in, QR scan, plans, achievements) works with no runtime errors on mobile.

## What's wrong today

Reviewing the module, the mobile problems are consistent and structural rather than one-off:

- Rows built as `flex flex-wrap items-center justify-between` (member list, staff check-in queue, today's attendance, notifications) collapse into ragged two-line blobs on a phone: name on one line, badges wrapping under, action buttons crammed beside a 96px weight input.
- Member detail opens in a side sheet with 7 tabs in a wrapping `TabsList` — on a phone that becomes a three-row block of tab pills before any content shows.
- Dialogs (create member, plan, batch, trial, achievement, measurement) use desktop padding and a fixed `max-w-lg`, so on a small screen they sit as a cramped centered box with the action buttons close to the bottom edge; long forms need a lot of scroll inside a short box.
- Charts in the member dashboard keep desktop tick density and height, so labels overlap on narrow widths.
- The QR page uses a `420px` fixed left column, which forces a squeeze at mobile width.
- Member portal tabs are top-of-page, which is far from the thumb; check-in — the single most used action — is a small tap target.

## What will change

**Shared card/list pattern.** Introduce one mobile-first list-row style used across Wellness: stacked layout on phones (title, meta line, badge row, then full-width action), switching to the current single-line row at `sm` and up. Applied to members, staff check-in queue, today's attendance, notifications, batches, plans, trials.

**Member detail.** Turn the 7 tabs into a horizontally scrollable tab strip on mobile (no wrapping), make the sheet full-height with a sticky header and sticky action bar, and reduce inner padding on phones. Numbers-first KPI tiles stay 2-up on mobile.

**Dialogs to sheets on mobile.** Create member, plan, batch, trial, measurement and achievement editors become bottom sheets on phones (full width, rounded top, scrollable body, sticky footer with full-width primary button) and remain centered dialogs on desktop. Forms go single-column at mobile width.

**Charts.** Reduce height, thin tick counts, shorter date labels and larger touch tooltips on small screens so the progress dashboard reads cleanly.

**QR page.** Stack poster above controls on mobile, drop the fixed 420px column, keep print output unchanged.

**Member portal.** Move navigation to a fixed bottom tab bar (thumb-reachable) with safe-area padding, make "Check in" the prominent primary action on the home screen, enlarge tap targets to 44px minimum, and tighten the plan/servings cards for narrow screens.

**Scanner.** Make the scan dialog full-screen on mobile with a large camera viewport, visible framing guide, clear permission-error states and an easy manual-code fallback.

## End-to-end verification

After the UI work, drive the app at a 360x800 viewport with a real signed-in session and walk: staff sign-in → dashboard → members list → create member (both steps incl. portal credential) → member detail tabs → record weight → check-in page → scan dialog → QR page → plans CRUD → achievements; then member portal sign-in → home → check-in via code → history. Capture screenshots at each step, check the console for errors and network calls for failed requests, and fix anything broken (layout overflow, RLS/permission errors, dead buttons) as part of this task.

## Technical notes

- No schema or business-logic changes planned. If verification uncovers a backend error (policy or RPC), it gets fixed then and called out.
- New shared pieces: a `ResponsiveDialog` wrapper (Dialog on desktop, Sheet on mobile) and a `WellnessListRow` presentational component, so the pattern stays consistent instead of repeated Tailwind.
- Styling stays on existing semantic tokens; no hardcoded colors.
- Horizontal-overflow guard: any remaining fixed widths (`w-24` inputs, fixed grid columns) are converted to fluid ones.
