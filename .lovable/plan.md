# Show one live serving balance

## Goal
Show only the member’s actual available servings from their active plan. Remove the separate “days left” number everywhere this plan balance appears.

## Changes
- **Member portal:** Replace the two-box “servings left / days left” area with one prominent **Servings left** balance.
- **Admin member overview:** Keep the **Servings left** tile connected to the active membership balance and remove the **Days left on plan** tile.
- **Admin Plan tab:** Replace the two-box summary with one **Servings left** balance.
- Keep the plan name, status, dates, renewal controls, payment details, and all existing actions unchanged.

## Balance behaviour
- Read the number from the active membership’s `remaining_servings` value.
- Continue using the existing attendance approval flow, which deducts one serving and refreshes the membership balance.
- Renewals, manual corrections, and packed/issued servings continue to update the same number.
- When there is no active plan, preserve the current “no active membership” state rather than showing a false balance.

## Verification
- Confirm member and admin screens show exactly one plan-balance number.
- Confirm the same `remaining_servings` value appears on both screens.
- Confirm the layout remains clear on mobile and desktop.
- Run the project type check after the edits.
