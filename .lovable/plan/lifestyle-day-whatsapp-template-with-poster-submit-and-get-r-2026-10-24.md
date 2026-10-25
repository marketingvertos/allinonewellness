# Lifestyle Day WhatsApp template with poster: submit and get ready to broadcast

## Template
- **Name:** `lifestyle_day_25_oct_2026`
- **Category:** Marketing
- **Language:** English (`en`)
- **Header:** Image (the uploaded Lifestyle Day banner)

**Body** (uses very few emojis):
```text
Hi {{1}},

You are invited to LIFESTYLE DAY on 25 October 2026, a full day dedicated to healthier, happier living.

Inspire • Motivate • Transform

Special Guest Speaker: a Senior Wellness Coach sharing valuable insights to inspire positive lifestyle changes.

Event Schedule
Breakfast: 7:30 AM – 8:30 AM
Main Event: 8:30 AM – 12:00 PM
Lunch: 12:00 PM – 1:00 PM

What you will take home
- A long-term vision for better health
- Ideas for a healthy and happy home
- The confidence and personality to inspire others

Venue: Anandam Club & Resorts, 47/2, 48/2, Ring Road, Near Medanta Hospital, Suyash Enclave, Patel Bagh Colony, Indore, Madhya Pradesh – 452010

Don't miss this life-changing experience. Be part of something extraordinary!
```
- Sample value for `{{1}}`: `Pawan`
- **Footer:** `All In One Wellness – Family Health Club`
- **Button:** Visit Website, labelled "View Location", linking to https://maps.app.goo.gl/LbbRScSF3MmSdvjYA

The line "Biggest Wellness Event in Madhya Pradesh" is left out because Meta often rejects claims nobody can check. It can go back in if you want it.

## Steps
1. Save the banner as a hosted image the app can use.
2. Send the template to Meta with the banner as its sample header image, using the same submission path that worked for the WLP invitation.
3. Link the banner to this template in the broadcast system, so every broadcast and retry sends this picture automatically.
4. Check that Meta shows the template as Pending and report back.
5. After Meta approves it: send one test to Pawan, then broadcast to the chosen member list.

## Notes
- The event is tomorrow (25 Oct). Meta review can take from minutes to hours, so approval may arrive late.
- Some members may not get the message because Meta caps how many marketing messages each person receives (error 131049). The existing retry rules already handle this.

## Technical details
- Upload the banner with lovable-assets and save the pointer in `src/assets/lifestyle-day-25-oct-2026.png.asset.json`.
- Submit through the `whatsapp-templates` function, which already supports image headers (it handles the Meta upload handle).
- Add `lifestyle_day_25_oct_2026` with the asset URL on the published domain to the template-to-poster map in `supabase/functions/whatsapp-broadcast/index.ts`, then redeploy.
- Read the status back from Meta's template list.
