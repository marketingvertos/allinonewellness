# Live Google Sheets Backup

Keep a live copy of all CRM data in a Google Sheet, refreshed every 15 minutes, plus a "Download full backup" button in Settings.

## What you will get

1. **A Google Sheet with 11 tabs**, refreshed every 15 minutes:
   Members Master, Active Memberships, Attendance Log, Payments, Serving Transactions, Trials, Weight Tracking, Body Measurements, Achievements, Pink Card Ledger, Daily Summary.
   Columns follow your guide, with names in place of IDs (plan, batch, referrer, staff), IST dates and INR amounts.
2. **Settings → Backup tab** (admins only):
   - Link to the sheet, time of the last sync and whether it worked.
   - "Sync now" button.
   - "Download full backup" — one Excel file with the same 11 tabs.
3. **Built-in database backups** stay on as the final safety net (nothing to set up).

## Change from the guide

The guide asks you to create a Google Cloud service account and paste a JSON key. Instead we use the built-in Google Sheets connection: you sign in with Google once on a connect card, and that's it. No Google Cloud setup, no keys.

## What you need to do

- Create an empty Google Sheet (e.g. "AIOW CRM Backup") in the Google account you'll connect, and paste its link when asked.
- Approve the Google Sheets connect card.

## Technical details

- Link the `google_sheets` connector; store the spreadsheet ID in `integration_credentials` (`sheets_backup_id`) plus `sheets_last_sync_at` / `sheets_last_sync_status`.
- New edge function `sync-sheets` (service role, reads all tables, paged past 1000 rows). Per tab: create tab if missing, `values:clear`, then `values:update` with header + rows via the connector gateway. Callable by cron (secret header) or by admins (JWT + `has_role admin`).
- pg_cron job every 15 min calling `sync-sheets`.
- Computed columns (age, birthday this month, weight change, days left) computed in the function, not as sheet formulas.
- Frontend: `BackupSettings.tsx` tab in Settings; export uses the same function with `?format=json` and builds the Excel file client-side with xlsx.
- Sheet is overwritten each run (mirror, not history); built-in database backups cover point-in-time recovery.
