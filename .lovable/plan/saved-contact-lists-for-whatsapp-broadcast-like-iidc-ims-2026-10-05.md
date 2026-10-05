# Saved contact lists for WhatsApp broadcast (like IIDC IMS)

## What you'll get
- On **WhatsApp broadcast**, step 2 "Recipients" gets a new choice: **Saved list**, next to Active members / Expired / Trial guests / Everyone.
- **New list** button opens a box where you:
  - give the list a name (e.g. "Family Day guests Oct 2026"),
  - paste contacts, one per line: `name, mobile`, or
  - **upload a file**: CSV or Excel (.xlsx). Name and 10-digit mobile are picked up from any column.
  - see "N valid numbers found" before saving. Duplicates and invalid numbers are dropped.
- You can make as many lists as you need, pick one from a dropdown (shows contact count), untick individual people, and delete a list.
- A list can hold anyone, including people who are not members. If a number matches an existing member, their message is still linked to their profile in Message Logs.
- Everything else stays the same: approved template, name personalisation (first name from the list), Family Day poster, test send, confirm, live progress, history, Retry failed.

## Implementation
1. Add two tables: saved lists (name, created by) and list contacts (list, name, phone), manager/admin only, same access as broadcasts.
2. Broadcast page: "Saved list" audience, list picker with counts, New list dialog (paste + CSV/Excel upload with live valid-count), delete list.
3. Broadcast function: accept either member ids (current) or a saved list id. For lists, load contacts server-side, match numbers to members where possible, dedupe, mark invalid numbers as skipped. Retry/resume unchanged.

## Technical details
- Tables `whatsapp_broadcast_lists` and `whatsapp_broadcast_list_members` with GRANTs + RLS using `is_wellness_manager`; cascade delete of contacts with the list.
- Parsing reuses the existing `xlsx` package (handles CSV and Excel). Phone kept as last 10 digits.
- `create` action gains `list_id`; recipients from lists store `member_id` when a number matches `wellness_members.mobile_number`, else null. Filters JSON records `list_id`.
