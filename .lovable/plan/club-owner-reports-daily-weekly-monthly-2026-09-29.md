# Club Owner Reports (Daily / Weekly / Monthly)

A new **Club Reports** page under Reports in the sidebar that recreates your paper "Daily Tracking Sheet" and "Club Owner Monthly Record", filled automatically from the CRM, with a few cells you type in yourself. Download as Excel or PDF.

## What you will see

**Daily register (one row per day of the month)**
S.No, Date, Total Shake, New Guest, Daily Shake, 3-Day TP (New / Repeat), 15 UMS (New / Renewal), 30 UMS Customer (New / Renewal), 30 UMS Coach, Total Amount, Cash, Swipe, PhonePe/Paytm/GPay, Online, Milk, Product Retail. Totals row at the bottom. Milk and Product Retail are typed in by clicking the cell.

**Weekly summary**
Same columns, grouped Mon–Sun weeks of the chosen month, with totals.

**Monthly record (18 lines, like the paper form)**
Auto-filled: Total Shake, New Guest, 3-Day Trials, 15 UMS, 30 UMS, New 30 UMS (customers only), New 15 UMS (customers only), Total customers in club, Total coaches, Total Amount, Profit (Amount minus Capital).
Typed in by staff: Volume Points, AE Qualify, Afresh Party, Lead Generation by Coach (pre-filled from coach referrals, editable), LSD Ticket, Capital Amount, Total Retail of All Coaches.

Month picker at the top, Excel and PDF download buttons on each view.

## Rules used
- All dates in India time.
- "15 UMS" = the 15 Visit White Card plan; "30 UMS" = NEW Gold Card UMS and RENEWAL Gold Card UMS. Plans are matched by number of servings, since your plans are serving-based.
- New vs Renewal: a renewal is any membership renewed from a previous one (the RENEWAL plan also counts as renewal).
- Coach = member tagged Coach.
- 3-Day TP = 3-Day Paid Trial; "Repeat" = a member starting a second trial.
- Total Shake and Daily Shake show the same number (daily attendance, including packed servings).
- Swipe = card payments. The 10-day plan and Daily Paid count in Total Amount but have no column of their own (same as the paper sheet).
- Only staff can view; managers/admins and coaches can type the manual cells.

## Technical details
- Migration: tables `daily_operations_log` (log_date unique, milk_amount, product_retail_amount, note) and `monthly_operations_summary` (month text unique, volume_points, ae_qualify_count, afresh_party_count, lead_generation_count nullable, lsd_ticket_count, capital_amount, total_retail_by_coaches), with GRANTs, RLS via `is_wellness_staff`, updated_at triggers.
- RPCs `get_club_daily_report(p_month)` and `get_club_monthly_report(p_month)` (security definer, staff-checked) computing counts with `AT TIME ZONE 'Asia/Kolkata'`.
- `src/hooks/useClubReports.ts`, `src/pages/ClubReports.tsx` with tabs Daily/Weekly/Monthly, components under `src/components/wellness/reports/` (DailyRegister, WeeklySummary, MonthlyRecord, EditableCell), `src/lib/reportExport.ts`.
- Excel via existing xlsx library if present (else add `xlsx`); PDF via print stylesheet.
- Route `/club-reports`, sidebar item in Reports group.
