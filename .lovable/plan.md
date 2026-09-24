# Attendance tab — school-register style attendance

A new **Attendance** page in the sidebar (right after Check-in) for staff to see who came and who didn't, with Excel export. It only reads data the app already has; nothing new is stored.

## What you will see
- **Top:** Physical / Virtual / All toggle, a search box (name or mobile), and an **Export to Excel** button.
- **Views:** Daily (default), Weekly, Monthly, Custom (From / To dates).
- **Summary tiles:** Present today, Absent today, Average attendance %, Best attendee, Total members.
- **Daily:** two lists side by side, Present (green) and Absent (red), each showing name, plan and servings left. Tap a name to open the full profile.
- **Weekly / Monthly / Custom:** a register grid with one row per member and one column per day. A tick means present, a cross means absent. Today's column is highlighted and future days are greyed out. The member name column stays fixed while you scroll sideways, which matters on phones. Each row ends with Present, Absent and % (green at 80% and above, grey at 50–79%, red below 50%).
- **Who is listed:** active, renewal-due, trial and expired members. Leads and inactive members are left out.
- **Export:** a spreadsheet with Sr., Member, Mobile, Mode, Plan, Servings left, a P or A column for each day, then Present, Absent and %. Indian dates. The file is named after the view and the date range.

## Adjustments to the guide
- The guide uses a mobile field name that doesn't exist. The real field, `mobile_number`, is used instead.
- Future days in the selected range don't count as absent, so percentages stay fair in the middle of a week or month.
- The week runs Monday to Sunday and all dates use Indian time (IST). Date columns are built without shifting time zones, so no day gets skipped or doubled.
- A member who checks in twice on the same day counts as present once.
- The existing attendance report on the Check-in page is left unchanged.

## Technical details
- `src/hooks/useWellness.ts`: add `useAttendanceRegister(from, to, memberMode)` plus the `AttendanceRow` / `AttendanceRegisterResult` types. The query reads members, their active/expiring/queued memberships with the plan name, and `wellness_attendance` for the date range. It pages past the 1000-row limit so long custom ranges don't lose rows.
- New `src/pages/WellnessAttendance.tsx`, following the structure in the guide. Profiles open through the existing `MemberSheetById`. Export is a CSV with a BOM so it opens cleanly in Excel.
- `src/App.tsx`: add the `/attendance` route inside AppLayout.
- `src/components/AppSidebar.tsx`: add an Attendance item with the `CalendarCheck` icon after Check-in.
- No database changes.
