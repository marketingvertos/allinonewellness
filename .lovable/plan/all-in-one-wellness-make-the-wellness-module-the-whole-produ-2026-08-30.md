# All In One Wellness — make the wellness module the whole product

Turn the CRM into a single-purpose wellness club app: All In One Wellness (Shri Chatap) branding, wellness as the only module, login as the entry point.

## 1. Strip the CRM modules

Remove from the app (UI only — no database changes, nothing dropped):

- Pages deleted: Pipeline, Contacts, Companies, Activities, Tasks, Calendar, Forecast, Reports, Import/Export, and the CRM dashboard (`Index.tsx`).
- Their routes, sidebar entries, supporting components (`pipeline/`, `contacts/`, `companies/`, `activities/`, `tasks/`, `dashboard/`) and hooks (`useDeals`, `useContacts`, `useCompanies`, `useActivities`, `useTasks`, `usePipelineStages`, `useEmailTemplates`, `useDealAuditLog`).
- Global search and notification centre are trimmed to wellness entities only.
- Settings keeps Profile, Team and Notifications; pipeline/email-template/CRM sections are removed.
- The CRM tables stay in the database untouched, so nothing is lost and this is reversible.

## 2. New entry flow

- `/` redirects to `/auth` (staff login). The marketing landing page is deleted.
- Auth screen is rebranded: circular All In One Wellness logo, teal/ivory background, and a clear secondary link "Member? Sign in to the portal" → `/portal/auth`.
- After staff login, `/dashboard` is the Wellness overview (the current `/wellness` dashboard becomes the main dashboard). Old `/wellness/*` paths keep working via redirects so existing links and QR posters don't break.
- Sidebar becomes a single flat wellness nav: Dashboard, Members, Check-in, Plans, Check-in QR, Trials, Batches, Notifications, Achievements, Settings.

## 3. Brand + colour scheme

Adopt the Shri Chatap brand system from the reference project, mapped onto this project's HSL token setup:

| Token | Colour |
| --- | --- |
| Primary | Deep teal `#014E4E` |
| Secondary | Dark teal `#0D3B3E` |
| Accent / highlight | Warm gold `#F9D67B` |
| Brown | `#4D3619` |
| Background | Ivory `#F4F2EC` |
| Card | White |

- Fonts: Fraunces (display/headings) + Inter (body), replacing Outfit.
- Dark mode kept: dark teal surfaces with gold as the primary accent.
- Chart, sidebar, status and badge tokens re-derived from the teal/gold palette (achievement tiers use gold/teal/brown gradations instead of the current orange).
- Uploaded logo uploaded as a CDN asset and used in the sidebar header, auth screen, member portal header and the printable check-in QR poster; the `DMark`/PipelineIQ marks are retired.
- Favicon and PWA icons regenerated as a square crop of the logo; `index.html` title, description, og/twitter tags and theme colour updated to "All In One Wellness — Family Health Club".

## 4. Technical notes

- No migration and no schema change. `wellness_members.contact_id` stays nullable and simply goes unused in the UI.
- `src/index.css` and `tailwind.config.ts` are rewritten with the new HSL tokens; components keep using semantic tokens so no hardcoded colours are introduced.
- `demo-login` and `member-access` edge functions are untouched; the demo login button on the auth screen is retained.
- Verification: typecheck, then a browser pass over the login screen, all wellness routes and the member portal at mobile and desktop widths to confirm no broken imports, no dead links and no contrast regressions.
