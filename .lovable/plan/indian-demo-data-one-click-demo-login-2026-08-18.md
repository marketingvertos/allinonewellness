# Indian Demo Data + One-Click Demo Login

## Goal
Make the CRM feel like an Indian sales app: rupee amounts, IST dates, Indian companies/people/cities/phones — and let anyone explore it instantly with a "Try demo" button on the login page.

## 1. Demo account
- Create a single demo user in the backend: `demo@vertos.in` with a fixed password, email pre-confirmed.
- Add a **Try demo** button on the login page that signs in with those credentials and lands on the dashboard.
- Small note under the button that this is a shared sample workspace.

## 2. Seed Indian sample data (owned by the demo user)
- Company: "Vertos Marketing Pvt. Ltd." with an INR-based pipeline.
- ~10 companies: e.g. Tata Digital, Infosys BPM, Zerodha, Nykaa Retail, Reliance Jio Platforms, Byju's, Swiggy, Paytm, Mahindra Logistics, Asian Paints — with Indian cities (Mumbai, Bengaluru, Pune, Gurugram, Chennai, Hyderabad).
- ~15 contacts with Indian names, `+91 9xxxxxxxxx` phone numbers, and company email domains.
- ~20 deals spread across pipeline stages with realistic INR values (₹1.5L to ₹85L), close dates over the coming quarter.
- ~15 tasks and ~25 activities (calls, meetings, emails, notes) with recent IST timestamps.
- Notifications and a couple of email templates written for the Indian market.

## 3. Currency, dates and locale
- Currency formatting switches to `en-IN` / INR, so values render as ₹12,50,000 (Indian lakh/crore grouping) instead of $.
- Compact figures show as ₹12.5L / ₹1.2Cr where short labels are used (charts, KPI cards).
- All dates and times display in Asia/Kolkata (IST) using day-month-year format (e.g. 18 Aug 2026, 4:30 PM).
- Any remaining hardcoded "$" or US-style placeholders in forms and imports get updated to ₹ and Indian examples.

## Technical notes
- `src/lib/formatters.ts`: `formatCurrency` → `Intl.NumberFormat("en-IN", { currency: "INR" })`; add `formatCompactCurrency` (L/Cr) and make `formatDate` / relative dates render in `Asia/Kolkata` via `date-fns-tz`.
- Seeding runs as a database migration inserting rows tied to the demo user's id, so RLS-scoped queries return the data for that account only.
- Demo credentials live in a small constant used by the login button; no other auth behaviour changes.
- Sample CSV templates in Data Import/Export updated to Indian names and INR values.
