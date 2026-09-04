# Keep your place (and your typing) when you switch browser tabs

## What happens today

When you leave the app in one browser tab and come back, two things go wrong:

1. Anything you typed on the WhatsApp settings screen but had not saved yet is wiped and replaced with the previously saved values.
2. The Settings page jumps back to the first tab (Profile) instead of staying on WhatsApp.

## Why

- Coming back to a tab makes the app re-check who you are. That check currently clears the stored answer, which briefly shows the loading screen and rebuilds the whole page — so the Settings screen starts over on its default tab.
- At the same time, the app re-reads the saved WhatsApp values from the server and copies them over the form, overwriting whatever you had typed.

## The fix

1. Only clear the access check on a real sign-in or sign-out (a new user), not on the automatic session refresh that happens when you return to a tab. Returning to a tab will no longer flash the loading screen or rebuild the page.
2. Fill the WhatsApp form from the server only the first time it loads (and after a successful save). Later background refreshes will not overwrite fields you are editing.
3. Remember which Settings tab you are on in the page address, so a refresh or a rebuild brings you back to the same tab. Same treatment for the other tabbed screens (Check-ins hub, member profile tabs) so they hold their place too.
4. Warn before leaving with unsaved WhatsApp credentials, so a stray navigation does not lose them.

## Technical notes

- `src/contexts/AuthContext.tsx`: track the previous user id; only call `queryClient.removeQueries({ queryKey: ["member-identity"] })` when the user id actually changes (or on `SIGNED_OUT`). Ignore `TOKEN_REFRESHED` / repeat `SIGNED_IN` events for the same user.
- `src/App.tsx`: give `new QueryClient` sane defaults — `refetchOnWindowFocus: false` for settings-style data (applied globally, lists still refresh on mutation invalidation).
- `src/components/settings/WhatsAppSettings.tsx`: replace the `useEffect([data])` sync with a one-time hydrate guard (`hydratedRef`), re-hydrating only after a save succeeds; add a `beforeunload` guard while the form is dirty.
- `src/pages/Settings.tsx`: controlled `Tabs` with `value`/`onValueChange` bound to a `?tab=` search param (default `profile`), matching the existing `/checkin?tab=` pattern.
- Apply the same `?tab=` persistence to the other multi-tab surfaces that reset (`Check-ins` hub already does; member detail sheet tab state kept in component state keyed by member).
