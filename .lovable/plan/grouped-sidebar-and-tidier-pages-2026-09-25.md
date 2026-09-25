# Grouped sidebar and tidier pages

Reorganise the side menu into clear sections and move overloaded tabs into their own pages. No data or backend changes.

## New side menu

```text
Dashboard
MEMBERS        Members, Trials, Achievements
OPERATIONS     Check-in, Attendance, Servings, Plans, Batches
COMMUNICATION  WhatsApp, WhatsApp templates, Message Logs, Notifications
REPORTS        Revenue, Events & Programs, Check-in Reports
(footer)       Settings, Sign out
```

- "WhatsApp templates" is kept (the document dropped it, but it is your only way to manage templates).
- "Message Logs" now has a menu entry.
- "Serving Reports" is renamed "Servings".

## Page changes

- **Check-in**: 3 tabs — Check in, Approvals, QR poster. "Today" moves to Attendance (Daily); "Reports" moves to Reports > Check-in Reports.
- **Revenue** (new page): the current Revenue tab, unchanged, on its own page.
- **Events & Programs**: the current Reports page minus Revenue (Family Day, Lifestyle Day, MIW, WLP).
- **Check-in Reports** (new page): the existing check-in report, unchanged.
- **Servings**: the existing serving reports page at a new address.

## Old links keep working

- `/reports` → Events & Programs; `/reports?tab=revenue` → Revenue
- `/serving-reports` → Servings
- `/checkin?tab=today` → Attendance; `/checkin?tab=reports` → Check-in Reports
- `/qr` and `/wellness/qr` still open the QR poster tab.

## Technical details

- `AppSidebar.tsx`: replace `mainNav` with `navGroups` rendered via `SidebarGroup` + `SidebarGroupLabel`; active state via `NavLink`.
- `WellnessReports.tsx`: export `RevenueTab`, drop the Revenue tab; new `pages/RevenueReport.tsx` and `pages/CheckInReportPage.tsx` wrap `RevenueTab` / `CheckInReports`.
- `WellnessCheckIn.tsx`: remove Today/Reports tabs; unknown `tab` values redirect as above.
- `App.tsx`: routes `/servings`, `/reports/revenue`, `/reports/events`, `/reports/checkin` plus redirects; update any internal links pointing at old URLs.
- Verify with a browser pass over every menu item and redirect.
