# Submit all drafted WhatsApp templates to Meta and switch them on automatically

Take the 24 messages in your template document, plus one new Yellow Card message, submit them to Meta for approval, and link each one to the event that sends it. Each message starts sending by itself as soon as Meta approves it.

## Templates being submitted

From your document (English, Utility unless noted), with your wording and sample values:

- Leads: lead_welcome_invite
- Trials: trial_welcome_day1, trial ending reminder, trial_completed_offer
- Membership: membership_welcome, renewal confirmation, payment_receipt, servings_packed_issued
- Wishes: birthday wish, member_anniversary_wish (Marketing)
- Progress: weight_loss_milestone, weight-gain milestone, family_day_qualified, consistency_26_days
- Titles: Master title, ambassador_title_achieved, supervisor_master_title
- MIW: miw_registration_confirmed, miw_challenge_starts, mid-challenge update, miw_challenge_completed
- WLP: wlp_checkin_confirmed, plus the other remaining items in the document

Not submitted again because they're already approved: checkin_approved_v2, renewal_reminder_servings, renewal_due_zero_servings, membership_reactivation_reminder, family_day_4_oct.

**New: yellow_card_membership** (Utility, document header). This message goes out with the member's Yellow Card PDF attached whenever they start a new plan or renew. The text says: "Hi {{1}}, here is your All In One Wellness Yellow Card for {{2}}. Code: {{3}} · Servings: {{4}} · Valid from {{5}}. Keep it handy at check-in." The Yellow Card is made automatically on our side for each member.

## How sending works

1. Every template is set up on the Notifications screen with its variables already mapped to member details, so nobody has to fill in {{1}}, {{2}} by hand.
2. Each one is linked to its event: lead created, trial started or ended, new plan, renewal, payment, servings packed, birthday or anniversary (9 AM daily check), weight milestone, Family Day qualification, 26-day consistency, title earned, MIW registration, start and completion, and WLP check-in.
3. Until Meta approves a template, its messages are held and nothing is sent. Once Meta approves it, that automation switches on by itself at the next status check, and only messages created from then on are sent. Old held messages are dropped, so members don't get old news.
4. Duplicate protection: the same event never sends the same message to a member twice.
5. The Notifications screen shows each template's status (Pending, Approved or Rejected), plus Meta's reason if one is rejected.

## Things to know

- Meta may reject some templates, especially Marketing ones like birthday and anniversary wishes. Each rejection is shown with Meta's reason so it can be reworded.
- Marketing messages may be limited by Meta for some members, the same as with the WLP broadcast.
- No messages go to guests who haven't given a mobile number.

## Technical notes

- Submit via the existing `whatsapp-templates` create action. Add support for a DOCUMENT header (upload a sample PDF to get the `header_handle`) and keep the image support as it is. Skip any name that already exists on the WABA.
- Seed or upsert `wellness_notification_templates` by `(trigger_key, channel)` with `template_name`, `template_language` and ordered `variables`. Add the new trigger keys to the list in `WellnessNotifications.tsx`, along with any new variables such as coach_name, miw dates, title name and wlp date.
- Add the missing queue triggers: lead insert, achievements for weight gain, family day, consistency and titles, MIW registration and completion, WLP check-in, and anniversary inside the daily cron. Reuse the existing triggers where possible.
- Yellow Card: build the PDF on the server with the same layout as `membershipCardPdf.ts` (in a shared module inside the function). Upload it to the private bucket and send a signed URL as the document header from the `whatsapp-notification-runner`. Queue the message on membership_activated and membership_renewed.
- The runner sends a message only when its template is APPROVED on Meta (status cached and refreshed by a scheduled sync). Items left pending for more than 24 hours are marked skipped.
- Before writing the triggers, check the full list of 24 templates against the parsed document.
