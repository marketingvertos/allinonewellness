# Distinct colors for Offers & Qualifications

## What will change
- Give each visible offer its own color treatment on both the team's Offers page and the member's home screen, instead of giving all tracked offers the same gold stripe.
- Use a varied, readable palette (teal, coral, blue, gold, green and others) for the offer edge, subtle background, icon accent and progress indicator. Keep the offer title, dates, target, reward and status easy to read.
- Keep the current green qualified celebration and clear Live/Upcoming/Ended badges so color never becomes the only way to understand an offer.
- Make the colors work in light and dark mode and on phones. Existing offer actions and progress calculations stay unchanged.

## Technical details
- Define themed offer-color tokens in the global design system and expose them through Tailwind.
- Use one shared offer-color helper for both screens. Assign different colors to offers visible together in a stable order, with the same treatment for each card's parts; cycle the palette if there are more offers than available colors.
- This is a presentation-only change: no migration, no changes to offer dates, eligibility, rewards or stored data.
- Verify both screens at desktop and mobile sizes, including qualified and announcement cards, then check the latest preview build result.
