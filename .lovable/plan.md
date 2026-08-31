# Use main logo as PWA icon

Regenerate all PWA/home-screen icons from the main All In One Wellness logo asset so the app icon matches the brand mark everywhere.

## What will change

- Source the main logo from `src/assets/aiow-logo.png.asset.json` (`/__l5e/assets-v1/.../all-in-one-wellness-logo.png`).
- Replace the four public icon files with square-cropped, padded versions derived from that logo:
  - `public/app-icon-192.png` (192×192)
  - `public/app-icon-512.png` (512×512)
  - `public/apple-touch-icon.png` (180×180)
  - `public/favicon.png` (64×64)
- Keep existing `public/manifest.webmanifest` and `index.html` references unchanged — they already point at these paths.
- Keep `BrandLogo.tsx` pointing at `/app-icon-512.png` so the sidebar/auth/portal mark stays in sync automatically.

## How

1. Download the logo asset to a temp path.
2. Use ImageMagick to produce each size: resize to fit inside the square with transparent padding, no stretching, centered.
3. Overwrite the four public PNGs.
4. Verify file sizes/types and do a quick visual sanity check on the generated icons.

## Out of scope

- No manifest, HTML, or component changes (paths remain the same).
- No service worker / offline work; this is manifest-only PWA icon update.
