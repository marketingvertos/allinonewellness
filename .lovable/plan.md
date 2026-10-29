# Servings reversal and introducer clean-up

## 1. Reverse an accidentally issued serving (admin only)
- In the member profile's serving history, each "Pack & Give" entry gets a **Reverse** button, visible only to admins.
- Clicking opens a confirmation asking for a required note (e.g. "Issued to wrong member").
- Reversing gives the servings back to the member's balance, removes the matching "S" mark from the attendance calendar, and adds a dated "Reversed" entry to history showing who reversed it, when and the note. The original entry stays visible, struck through, marked "Reversed".
- An entry can only be reversed once. No WhatsApp message is sent.
- The member app history shows the reversal too.

## 2. Map introducers for older members
Current data: 188 members — 145 already linked to a club member, 14 have only a typed name, 29 have nothing.
- Typed names that exactly match a club member (7 found) get linked to that member automatically.
- Members with a Pink Card referral credit but no introducer (1 found) get linked to the referrer who earned it.
- Remaining typed names stay as "Someone else". The rest stay "Not recorded" and can be set from the report or profile.
- I'll show you the list of changes before saving any of them. Pink Card balances will **not** change because of this mapping.

## 3. Same introducer picker in Edit profile
- Replace the old referrer box in the Edit member dialog with the new **Club member / Someone else** picker (name + mobile for outsiders), same as registration and trial forms.

## 4. Introducer shown at the top of the profile
- Under the member's name at the top of the profile: "Introduced by **Name**" (tap opens that member) or "Introduced by Name (outside)".
- If none is set: a "Set introducer" button opening the same picker.
- Remove the duplicate introducer box at the bottom of the Overview tab.

## Technical details
- New migration: `reverse_serving_issue(_txn_id, _note)` security-definer RPC checking `has_role(auth.uid(),'admin')`; adds `reversed_at/reversed_by/reversal_note` to `serving_transactions`, inserts a compensating `manual_adjustment` row (+qty), deletes S attendance rows tied to that issue, increments membership balance.
- Data mapping via one-off update queries after a dry-run preview.
- Edits: `MemberDetailSheet.tsx` (header tag, reverse button, remove bottom box), `EditMemberDialog.tsx` (swap ReferrerPicker for IntroducerEditor fields), `servingLabels.ts`, `PortalHistory.tsx`.
