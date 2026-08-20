# Fix: camera does not open in the in-app QR scanner

## What is happening

The scanner sheet opens, the loading spinner disappears, but the preview stays blank — no camera image, no error message. Three defects in the scanner component explain this:

1. The scanner effect depends on the `onResult` / `onOpenChange` callbacks, which are new function objects on every render. The effect tears the camera down and restarts it in a loop, so the stream is stopped almost as soon as it starts.
2. The `<video>` element has no `autoPlay`; on mobile Chrome/Safari the stream attaches but never plays, giving a blank square.
3. Camera failures are swallowed into one generic message and the spinner is cleared regardless, so a denied/blocked permission looks like "nothing happened".

## The fix

Rewrite `QrScannerSheet` around an explicit, predictable flow:

- Request the camera directly with `getUserMedia({ video: { facingMode: "environment" } })`, attach the stream to the video, call `play()`, then hand the live stream to the zxing decoder.
- Keep the callbacks in refs so the effect runs only when the sheet opens/closes — no restart loop.
- Video gets `autoPlay muted playsInline` so mobile browsers actually render frames.
- Stop every media track on close/unmount so the camera light turns off.

Clear, specific states instead of one generic error:

- Permission denied → "Camera access is blocked. Allow camera for this site in your browser settings, or enter the centre code below."
- No camera found / already in use → matching message.
- Page not served over HTTPS (browsers block the camera on plain http) → tells the user to open the published https link.
- Preview inside an editor iframe without camera permission → detected and explained, with the manual code entry still working.

Also add `allow="camera; microphone"` guidance where the app is embedded, and keep the manual "enter the centre code" fallback exactly as it is today so check-in never gets blocked.

## Verification

- Run the portal check-in page in a headless browser with a fake camera device and confirm the video element reports non-zero dimensions and a playing stream.
- Confirm a denied-permission run shows the specific blocked-camera message rather than a blank box.
- Confirm closing the sheet releases the camera track.

## Technical notes

- File: `src/components/wellness/QrScannerSheet.tsx` (single-file change; both `PortalCheckIn` and `WellnessCheckIn` consume it unchanged).
- Use `BrowserQRCodeReader.decodeFromStream(stream, videoEl, cb)` instead of `decodeFromConstraints`, so stream acquisition errors are distinguishable from decode errors.
- Guard on `window.isSecureContext` and `navigator.mediaDevices` before requesting.
- Map `DOMException.name` (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`) to the messages above.
