# Send the Family Day poster with the approved WhatsApp broadcast

## What you’ll get
- On **WhatsApp broadcast**, select the approved `family_day_4_oct` template and see the attached Family Day poster alongside the message preview.
- **Send test** sends that same template and poster to one number first. **Send to members** then sends the same combination to the selected audience, with the existing confirmation, progress, history, and failed-recipient details.
- The poster is the image you attached in this conversation. No bulk message is sent as part of implementation or testing.

## Implementation
1. Confirm the live approved template’s language and header format before sending. The app currently detects that a template has a media header, but its sender always formats media as a **document**. If the approved header is not an image header, stop image sending and explain that a matching approved image template is needed; do not alter the approved template or send a separate unsolicited picture.
2. Store the supplied JPEG as a project-hosted, publicly retrievable image asset. Show its preview only for `family_day_4_oct`, and make both test and broadcast unavailable if the image cannot be reached or the selected template is not approved.
3. Extend the shared WhatsApp sender to support an **image template header** without changing existing document-header messages. Send the picture as the image header component of the approved template, not as a separate WhatsApp message.
4. Save the poster reference and image header type with each broadcast so background batches, resumed sends, and failed-recipient retries always use the exact same picture. Validate the chosen template and media details on the server before queueing; keep the existing staff authorization and per-message logs.
5. Verify the image URL is publicly readable, the template/header match, and a one-number test actually reaches WhatsApp with the poster. Check the broadcast screen at desktop and phone widths. Only mark the send as verified when the provider accepts the test; otherwise show the provider’s reason and leave the bulk send blocked.

## Technical details
- Update the broadcast page, broadcast function, shared WhatsApp request builder, and add nullable media fields to the existing broadcast record; no new recipient table is needed.
- Preserve the existing background queue and shared send logger. Keep the stored media URL absolute and immutable for queued sends.
