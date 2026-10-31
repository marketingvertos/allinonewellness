# Birthday & Anniversary wishes with creatives at 6:00 AM IST

## What exists today
- Birthday and anniversary WhatsApp wishes already run automatically (templates `member_birthday_wish` and `member_anniversary_wish`, both approved), but they are **text only** and the daily job runs at **9:00 AM IST**.
- Members' anniversary dates are already stored (married members).

## What we will build
1. **Creatives stored for sending** — upload the two uploaded images (Happy Birthday cake, Happy Anniversary rings) to public storage so WhatsApp can attach them.
2. **New picture templates sent to Meta** (UTILITY/MARKETING per Meta rules, English):
   - `member_birthday_wish_img` — image header = birthday creative. Body: "Dear {{1}}, wishing you a very Happy Birthday from all of us at All In One Wellness Family Health Club! May this year bring you good health, happiness and beautiful moments. Keep shining and keep smiling. – Shri Chatap"
   - `member_anniversary_wish_img` — image header = anniversary creative. Body: "Dear {{1}}, Happy Anniversary! Wishing you both a beautiful journey filled with love, happiness and togetherness. Warm wishes from All In One Wellness Family Health Club. – Shri Chatap"
   - Personalised with each member's name.
3. **Safe switch-over** — stage them as replacements on the existing birthday/anniversary rows. Current text wishes keep going until Meta approves; then the system switches to the picture version by itself and attaches the right creative.
4. **Send time 6:00 AM IST** — move the daily birthday/anniversary job from 9:00 AM to 6:00 AM IST, and make sure the message runner sends them right after (it runs every 10 min, so wishes land between 6:00 and ~6:10 AM). Never at midnight.
5. **Check of previous templates** — all earlier templates are approved and mapped (incl. the new WLP attendance message, already live). Only `login_credentials` is **rejected** by Meta — I will report it; I can resubmit a reworded version if you want.

## Technical details
- Storage: public bucket `whatsapp-media` (create if missing), files `birthday_wish.jpg`, `anniversary_wish.jpg` via storage_upload.
- Templates created through the existing `whatsapp-templates` edge function with `HEADER` format IMAGE + `example.header_handle` (upload media handle) and body example.
- Update `wellness_notification_templates` rows `birthday`/`anniversary`: `next_template_name`, `next_variables=[name]`, plus header media URL in the field the shared sender already uses for image headers (as for approved-template broadcast images).
- Verify the runner passes `header.image.link` for these triggers; extend the shared sender if needed.
- `cron.alter_job` for `daily-birthday-notifications`: `30 3 * * *` → `30 0 * * *` (00:30 UTC = 06:00 IST); confirm the queue function uses Asia/Kolkata date.
- Add a small test that the IST send time and the date-matching (birthday/anniversary month+day, IST) are correct.
