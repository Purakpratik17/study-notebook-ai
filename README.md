# Learnova

A modern, gamified AI study app: type any academic topic and get structured
notes plus a multiple-choice quiz, plan study sessions in a timetable, complete
daily quests, and earn XP to level up. Notebook-themed UI, Clerk authentication
(Google + email), Convex backend.

**Stack:** React 19 · Vite · TypeScript · Tailwind CSS 4 · shadcn/ui · Clerk ·
Convex · Capacitor (Android)

---

## 1. Features

- **Auth** — Google + email sign-in/sign-up via Clerk; persistent sessions; per-user data isolation (every Convex record is keyed on the Clerk identity's `sub` claim)
- **AI Study** — any topic → structured notes (sections, key exam points, formulas, summary) + a 5-question MCQ quiz with explanations, scoring and retry
- **XP & levels** — configurable economy (`src/convex/data.ts`), 5 levels (Beginner → Expert), level-up toasts, progress bars
- **Timetable** — create study sessions (subject/date/start/end/notes), check them off for XP
- **Quests** — daily seeded rotation (easy/medium/hard) that progresses automatically from real app activity
- **Profile** — streaks, totals, quiz average, level ladder
- **Duplicate-XP protection** — every XP grant is journaled in `xpEvents` with an idempotency key (`task:<id>`, `quest:<rowId>`, `quiz:<noteId>:<date>`, …); unchecking/rechecking a task can never double-reward

## 2. Local development

```bash
bun install
bunx convex dev --once     # regenerate Convex types + push functions
bun run dev                # Vite dev server
```

Create `.env.local` from the variable list in [ENVIRONMENT.md](ENVIRONMENT.md).

## 3. Production web build

```bash
bun run build              # tsc -b && vite build → dist/
bun run preview            # serve the production bundle locally
```

Before going live:

1. **Claim the Clerk app** (`npx clerk@latest auth login`) and create a
   production instance; put the production publishable key in env and the
   production Frontend API URL in `src/convex/auth.config.ts`.
2. Deploy Convex (`bunx convex deploy`) and set private env vars in the Convex
   dashboard (see [ENVIRONMENT.md](ENVIRONMENT.md)).

## 4. Android (Capacitor → Google Play)

The web app is wrapped with [Capacitor](https://capacitorjs.com). The Android
project lives in `android/` (preconfigured: icons, splash, deep links, Play
compliant target SDK 36).

### 4.1 Prerequisites

- Android Studio (with SDK 36) — `brew install --cask android-studio` or https://developer.android.com/studio
- JDK 17+
- One-time: `bun install && bun run build` (dist/ must exist before any `cap` command)

### 4.2 Sync the web bundle into Android

```bash
bun run build       # rebuild the web bundle
bunx cap sync android
```

### 4.3 Run on a device / emulator

```bash
bunx cap open android   # opens Android Studio → Run ▶
```

Authentication on Android: Clerk sign-in opens the **system browser**
(Custom Tabs). Google OAuth / email verification returns via the
`studynotebook://` deep link, which is completed by
`src/components/NativeAuthBridge.tsx`. Sessions persist inside the WebView.

### 4.4 Clerk configuration (dashboard — do this once)

1. **Claim your Clerk app** and open the [Dashboard](https://dashboard.clerk.com).
2. **Native applications** page → enable the **Native API**, add your Android
   app (package name `com.studynotebook.ai`) and set the custom URL scheme to
   `studynotebook` (matches `android/app/src/main/AndroidManifest.xml`).
3. **OAuth redirects allowlist** — add `studynotebook://sso-callback`.
4. Google social connection is enabled by default for dev instances; for
   production use your own Google OAuth credentials (Web Client ID + secret in
   Clerk, per Clerk's *Sign in with Google* guide).

### 4.5 Build the release AAB

Generate your upload keystore (once — keep it safe, never commit it):

```bash
keytool -genkeypair -v -keystore android/app/upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/keystore.properties` (gitignored):

```properties
storeFile=upload-keystore.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

Build:

```bash
bun run build
bunx cap sync android
cd android
./gradlew bundleRelease       # → android/app/build/outputs/bundle/release/app-release.aab
```

> Without `keystore.properties` the release build falls back to the debug key —
> fine for device testing, **never** upload that to Play.

Bump `versionCode` / `versionName` in `android/app/build.gradle` for every
release.

### 4.6 Upload to Google Play Console

1. Create the app in [Play Console](https://play.google.com/console) (App name,
   `com.studynotebook.ai`, listing, screenshots, privacy policy).
2. **Play App Signing** (on by default) — upload your upload key's public
   certificate: *Setup → App signing → Upload key*.
3. *Testing → Internal testing* → create a release → upload `app-release.aab`
   → roll out to testers.
4. Complete the Data safety form (data stored: email, user content, app
   activity — all tied to accounts; encryption in transit: yes; deletion
   request: via profile/account deletion).
5. Content rating questionnaire, target audience, and app access declarations.
6. *Production → Create release → upload the AAB → review → Start rollout.*

### 4.7 Android config already in place

| Item | Value |
| --- | --- |
| Application ID | `com.studynotebook.ai` |
| Version | `versionCode 1`, `versionName "1.0.0"` |
| Target SDK | 36 (Android 16 — meets the Aug 31 2026 Play requirement) |
| Min SDK | 24 (Android 7.0) |
| App icon | Adaptive icons generated from `public/logo.svg` (all densities) |
| Splash | Light `#f8f4e8` / dark `#0c0a09`, 1.5s, auto-hide |
| Deep link | `studynotebook://sso-callback` (Clerk OAuth return) |

## 5. Repository hygiene

- `.env*`, keystores, `android/keystore.properties`, and build outputs are gitignored — **never** commit secrets
- `src/convex/_generated/` is regenerated, not committed
- All secrets are server-side (Convex dashboard / platform-injected); the client bundle only contains publishable identifiers

## 6. Verification checklist

- Sign up with Google and with email → dashboard loads with user name
- Log out → log back in → XP, level, tasks, quests, notes all restored
- Complete a task twice (uncheck → check) → XP awarded exactly once
- Generate notes offline / API failure → friendly error, retry works
- Mobile layout → bottom nav, responsive cards, touch-friendly controls
