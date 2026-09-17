# Mark Pink Card reward as redeemed

## What changes

On a member's Pink Card card, admins and managers get a **Mark redeemed** button next to the existing Adjust button.

Tapping it opens a short form:

- **Servings to redeem** — pre-filled with the member's full balance, editable for a partial redemption. Shows the rupee value as it is typed.
- **Note (optional)** — free text, e.g. "adjusted against the renewal paid in cash".

Saving deducts the servings from the balance and writes a "Redeemed at renewal" line into the Pink Card history with the date and the note, exactly like the automatic renewal redemption.

Rules:

- The button is hidden when the balance is zero, and members never see it in the portal.
- You cannot redeem more than the current balance.
- No WhatsApp message is sent for a manual redemption.

## Technical notes

- `src/components/wellness/PinkCardPanel.tsx`: add a second manager-only button and a `ResponsiveDialog` mirroring the existing Adjust dialog; state `credits` (default `bal`) and `redeemNote`; Save calls the existing `useRedeemPinkCard()` mutation with `{ memberId, credits, membershipId: null, note }`; disable Save when credits is 0 or above `bal`.
- No backend change: `redeem_pink_card` already validates the balance, writes `renewal_redemption` with the note, and `reasonLabel` already renders it; `formatDate(row.created_at)` supplies the redemption date.
- Verify with `npx tsgo --noEmit -p tsconfig.app.json`.
