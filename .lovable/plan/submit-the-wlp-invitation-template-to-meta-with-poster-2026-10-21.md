# Submit the WLP invitation template to Meta (with poster)

Submit `wlp_wellness_program_invitation` for approval using your exact Hindi text, with the WLP poster as the picture at the top, so the same template can be broadcast to members once Meta approves it.

## Template being submitted

- Name: `wlp_wellness_program_invitation`
- Category: Marketing, Language: Hindi (`hi`)
- Header: the WLP poster image (Meta allows only one header, so the poster replaces the text header "WLP – Wellness Living Program"; that line stays in the footer)
- Body: your text, personalised as `🌿 नमस्कार {{1}} जी!` (member's first name). Sample for Meta: "राहुल". Date, time and venue stay as written. The typo "प्रप्त" is corrected to "प्राप्त".
- Footer: WLP – Wellness Living Program
- Button: Visit Website, "View Location", https://maps.app.goo.gl/ZhiVbzj4LsjyrH7UA?g_st=ac

## Steps

1. Upload the poster to Meta as the sample image (required to submit an image-header template).
2. Create the template on your WhatsApp Business account and confirm it shows as Pending.
3. Save the poster in the app so the Broadcast page sends this same picture with every message.
4. Once approved: open WhatsApp → Broadcast, pick this template, choose Active members, send a test to yourself, then send to all.

## Technical notes

- Poster stored via Lovable Assets and in the private promotion-media bucket; header uploaded through Meta's resumable upload API to get the `header_handle`, then `POST /{WABA_ID}/message_templates` with IMAGE header, BODY (`example.body_text`), FOOTER, URL button — done server-side through the existing whatsapp-templates function (adding a `header_image_url` option if not present).
- Broadcast record keeps the image link so retries resend the same picture.
- Meta reviews Marketing templates; approval is usually minutes to a few hours and is not guaranteed.
