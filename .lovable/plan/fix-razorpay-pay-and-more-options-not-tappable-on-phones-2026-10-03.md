# Fix: Razorpay "Pay" and "More Options" not tappable on phones

## Cause
When you tap Pay, Razorpay's own payment sheet opens **on top of our "Pay online" window, which stays open**. Our window is a locked pop-up: while it's open, it blocks taps everywhere outside itself. That includes Razorpay's sheet, so Pay, More Options and close do nothing. iPhone Safari is worst affected because it also keeps the page scroll lock.

## Fix
1. **Close our window first.** After the order is created, close the "Pay online" window and wait for it to fully close. Then open Razorpay, so nothing sits on top of it.
2. **Clear leftover locks.** Before opening Razorpay, clear any leftover tap or scroll block on the page. On iPhone it can stay behind after the window closes.
3. **Make sure Razorpay is on top.** Give Razorpay's sheet the top layer, so the bottom bar and our header can't cover it.
4. **Handle the result after the window has closed:**
   - On success: verify the payment, show "Payment successful", then refresh the plan and servings.
   - If the member cancels or the payment fails: show a short message with a "Try again" button that reopens the plan picker with the same plan selected.
5. **Stop double taps.** Keep the "Opening…" spinner, and ignore extra taps until Razorpay has opened.

## Check
On a phone-size screen in iPhone and Android mode, open Razorpay and confirm that Pay, More Options and close each respond to a tap. Then check cancel and retry, and confirm desktop still works.

## Technical details
- Change `PayOnlineDialog.tsx`: call `onOpenChange(false)`, wait for the window to finish closing (about 300ms), then remove the `pointer-events:none` and scroll-lock styles from `body`/`html` and call `rzp.open()`. Move the success, dismiss and failed handlers into the parent (`PortalHome`) using callbacks, so they still run after the window unmounts.
- Add a CSS rule giving `.razorpay-container` `z-index: 2147483647` and `pointer-events: auto`.
