# Public registration form for new leads

A shareable link anyone can open without logging in. Every submission lands in your member list as a **Lead**, and the team gets a WhatsApp alert.

## The link

`/join` — one common link, open to everyone (also works on the published site and custom domain). No login, no app menu, just the form with your logo.

## What the form asks

Same as the club registration form:

- Full name (required)
- WhatsApp number (required, 10 digits)
- Alternate mobile number
- Date of birth (DD/MM/YYYY)
- Anniversary date
- City
- Height in cm
- Weight at club join
- Health issues / notes
- Consent line before the submit button

Checks: name and WhatsApp number required, sensible limits on every field, and a friendly message if the same WhatsApp number has already registered.

## After they submit

- A thank-you screen: "Thank you, we'll contact you on WhatsApp shortly."
- The person appears in Members with status **Lead**, joining date today, goal weight loss, marked as a physical member, tagged as coming from the public form.
- Health issues are saved as a note on their profile.
- A WhatsApp alert goes to the team with the name, number, city and weight.

Leads do **not** get a portal login automatically — you convert them from the member profile as usual.

## Where you find the link

Settings gets a "Public registration link" card with the full URL, a Copy button and an Open button, next to the existing display-screen links.

## Technical notes

- New public route `/join` (outside `AppLayout`), page `src/pages/PublicRegister.tsx`, plus a `PublicRegisterSuccess` state; SEO title/description set on the page.
- Submissions go through a new edge function `public-register` (`verify_jwt = false`, CORS, zod validation, service-role client). No anon insert policy is added to `wellness_members`, so the table stays locked down.
- The function: normalises the mobile to 10 digits, rejects duplicates against `wellness_members.mobile_number`, inserts the member (`status: 'lead'`, `member_mode: 'physical'`, `goal: 'weight_loss'`, `joining_date` = today IST, `created_by` = the admin service account id, `tags` includes `public_form`), inserts a `member_notes` row when health issues or the alternate number are given, and returns `{ ok: true }` only.
- Alternate number and city have no columns today; both are stored in the member note so nothing is lost. No schema migration needed.
- Team alert reuses the existing WhatsApp send path (`_shared/whatsappService.ts`). The destination number is read from `integration_credentials` key `lead_alert_phone`; a Settings field lets you set it, and nothing is sent while it is empty.
- Basic abuse protection: per-IP throttle (max 5 submissions per 10 minutes) inside the function, and a hidden honeypot field on the form.
