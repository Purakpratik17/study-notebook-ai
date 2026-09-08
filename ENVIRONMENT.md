# Environment Variables & Secrets

Copy the **public** block into `.env.local` (web dev) and/or `android/.env` for
Android builds. **Private** variables live in the **Convex dashboard**
(Settings → Environment Variables) or your own secret store — never in the
client bundle.

> The workspace has a platform-sensitive-file guard: `.env` files cannot be
> created by tooling. Create `.env.local` manually from this reference.

## Public / client (`VITE_*`) — safe to bundle

| Variable | Example / where to get it | Used by |
| --- | --- | --- |
| `VITE_CONVEX_URL` | `https://pastel-rook-584.convex.cloud` (printed by `bunx convex dev`) | `src/main.tsx` (Convex client) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` (dev) / `pk_live_…` (production) from the Clerk Dashboard → API keys | `src/main.tsx` (ClerkProvider) |
| `VITE_APP_URL_SCHEME` | `studynotebook` — must match `AndroidManifest.xml` and the Clerk "Native applications" custom scheme | Android OAuth deep link |
| `VITE_VLY_APP_ID` | Freebuff project id | preview/monitoring metadata |
| `VITE_VLY_MONITORING_URL` | Freebuff monitoring ingest URL | error reporting |

These are identifiers, not secrets. The Clerk **publishable** key and the Convex
cloud URL are designed to be public; they cannot mutate your data.

## Private — server only (Convex dashboard → Settings → Environment Variables)

| Variable | Purpose | Notes |
| --- | --- | --- |
| `VLY_INTEGRATION_KEY` | AI gateway auth for `src/convex/ai.ts` (`vly.ai.completion`) | Auto-injected in this workspace. **Never** prefix with `VITE_`. Rotating it costs nothing client-side. |
| `VLY_INTEGRATION_BASE_URL` | Gateway base URL | Default `https://integrations.freebuff.com/` |
| `VLY_APP_NAME` | App name in Convex Auth OTP emails | e.g. `Study Notebook AI` |
| `CONVEX_SITE_URL` | Self-issued Convex Auth issuer | Set automatically by Convex |
| `CLERK_SECRET_KEY` | Only if you add Clerk Backend API calls later | Keep out of the repo |

**AI request path (server-side only):** `AiStudy` page → Convex **action**
`src/convex/ai.ts` (`"use node"`) → gateway → OpenAI model. The key lives in the
Convex runtime; the web bundle and the Android APK never contain it.

## Clerk backend issuer

`src/convex/auth.config.ts` validates Clerk JWTs against the app's **Frontend
API URL** (public, not a secret). Because Convex auth configs cannot use
optional env fallbacks (every referenced var must be set), the value is a
hardcoded literal:

- **Dev (current):** `https://awake-marmoset-1455.clerk.accounts.dev`
- **Production:** replace the literal with your production Frontend API URL
  (e.g. `https://clerk.yourapp.com`), then redeploy with `bunx convex dev --once`.

## Android signing (files, not env vars)

Create `android/keystore.properties` locally or in CI — it is **gitignored**:

```properties
storeFile=upload-keystore.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

Generate your upload keystore yourself (do not commit it):

```bash
keytool -genkeypair -v -keystore android/app/upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

`android/app/build.gradle` signs release builds with these values and falls
back to the debug key only when the file is absent (local testing). **Never**
upload a debug-signed bundle to Google Play.
