# Keep packed servings out of check-in counts

A packed serving means the member was **not** at the club. From now on it is never counted as a check-in or as present. It still shows as "S" on the attendance calendar and still uses up a serving.

## What changes

**Dashboard**
- The "Check-ins today" number and today's check-in list count only real club visits (QR, front desk, barcode, staff entry).
- The existing "Servings issued today" card stays as it is, so packed servings remain visible there.

**Check-in screen**
- Today's list shows only members who actually came in.
- If a packed serving already covers today and the member then walks in, they are told "Serving already issued (packed) for today", as now.

**Attendance page**
- "Present today" counts club visits only.
- New tile: **Serving issued today**, a count of packed servings for today.
- "Absent today" = members with neither a visit nor a packed serving.
- Daily view has three lists: **Present**, **Serving issued** (out of the club, with the packed date and reason) and **Absent**. Ravi and Santosh Kumawat from your screenshot will move from Present to Serving issued.
- The weekly, monthly and custom calendar still marks packed days with "S". Totals show visits and servings separately, for example "20 visits · 5 servings". Only visits count towards the attendance %.
- Excel and PDF exports follow the same split.

**Check-in reports and member visit counts**
- Visit counts, best attendee and the member's monthly attendance count only club visits.

**Stays the same**
- Packed servings still reduce the serving balance and trigger renewal reminders.
- Sales and servings totals still include packed servings, because product was handed out.
- The club report's "total shakes" also still includes them.
- The member's own history still lists packed servings, labelled "Serving issued".

## Technical details
- Add `.neq("checkin_method", "serving_issue")` to `useTodayAttendance`, the `useWellnessStats` check-ins count, `useCheckInReport`, `useMyMonthlyAttendance` (useEvents) and the consistency/26-day counts in the progress card.
- Leave `useServingTrend`, `useSalesAnalytics`, the club report "shakes" and `useMemberAttendanceOnDates` (used to block duplicate dates) unchanged.
- `useAttendanceRegister`: `todayPresent` counts only "visit" marks. Add `todayServed`. Absent = total − present − served. Per row, `presentDays` = visit days only, with `servingDays` reported separately. The % uses visits only.
- `WellnessAttendance.tsx`: add the tile, a third `MemberList` "Serving issued" (tone muted), and split the totals column. Update `reportExport`/`reportPdf` columns the same way.
- Check-in page list: filter out `serving_issue` rows.
