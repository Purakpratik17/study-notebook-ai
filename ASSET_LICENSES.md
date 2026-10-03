# Cerevyn — Asset & License Inventory

Internal documentation for the licenses of assets and third-party code
shipped with Cerevyn. Update this file whenever a new asset or dependency
is added. Nothing here asserts a legal conclusion — it records evidence.

## Fonts

| Asset | Source | License | Evidence |
|---|---|---|---|
| Inter (variable, latin + latin-ext) | Self-hosted in `public/fonts/` (files obtained from Google Fonts' official font files for Inter v20) | SIL Open Font License 1.1 | OFL permits redistribution; original Google Fonts source URL for Inter v20 |

Note: the app loads fonts **only** from `public/fonts/` via `@font-face` in `src/index.css`. There are no runtime requests to `fonts.googleapis.com` or `fonts.gstatic.com` (verified against source and build output).

## Icons

| Asset | Source | License | Evidence |
|---|---|---|---|
| All UI icons | `lucide-react` npm package | ISC | LICENSE file in the lucide-react package |

## Images / Logos

| Asset | Source | License | Evidence |
|---|---|---|---|
| `/public/logo.svg`, `/public/cerevyn-logo.svg`, `src/assets/logo.svg` | Project-authored (app branding) | Project-owned | Created for this project |
| Launcher icon (Android res) | Generated via `@capacitor/assets` from project logo | Project-owned | Generated from the above |

## Sounds

| Asset | Source | License | Evidence |
|---|---|---|---|
| All UI/arcade sounds | Synthesized at runtime with the Web Audio API (see `src/hooks/use-settings.ts`) | None needed — no audio assets shipped | Zero sound files exist in the repo |

## Fonts not verified

None — all fonts in use are listed above.

## Unverifiable items to review

- None currently identified. If artwork, illustrations, videos or game
  assets are added later, record their source and license here before
  shipping.

## Key third-party dependencies (what they receive)

| Service / SDK | Purpose | Data it may receive |
|---|---|---|
| Clerk | Authentication | Email, profile name, sign-in session data |
| Convex | Backend/database/storage | All app data (server-side, access-controlled) |
| NVIDIA NIM (AI gateway) | Notes/quiz/tutor generation | Prompt text and snapped photos sent for a request |
| Google AdMob (Android only) | Advertising | Device identifiers and ad interaction data (per Google's policies) |
| Google Play Billing (Android only) | Chat+ subscription | Purchase token, order id (server-verified) |
| (none) | Fonts are self-hosted — no font CDN receives requests | — |

No analytics, tracking, or marketing SDKs are present.
