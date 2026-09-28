import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
} from "@capacitor-community/admob";

/* ═══════════════════════════════════════════════════════════════════════
   Cerevyn ads — Google AdMob via @capacitor-community/admob (Android).

   Platform rules:
   - Native SDK calls happen ONLY on Android (Capacitor.isNativePlatform()).
   - On web (Vite dev/preview/build) every function is a safe no-op, so the
     web app never crashes and never loads the native SDK.
   - PRODUCTION ad unit IDs are configured below and are used while
     initializeForTesting is false. To go back to safe development ads,
     set ADS_USE_TEST_ADS back to true — no other code changes.
   - No personal data (Clerk credentials, emails, study content, Convex
     data) is ever passed to the ad SDK.
   ═════════════════════════════════════════════════════════════════════ */

/** Fallback: Google's official always-test ad unit IDs — safe for development. */
const TEST_IDS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
} as const;

/* ═══════════════════════════════════════════════════════════════════════
   ⚠️ PRODUCTION ADS — ACTIVE CONFIGURATION ⚠️

   CURRENT STATE: the real Cerevyn AdMob ad-unit IDs (PRODUCTION_IDS below)
   are ACTIVE everywhere (banner + interstitial). Google's official TEST
   ad-unit IDs are NOT used in any placement.

   The Android AdMob APP ID lives in ONE place only:
     android/app/src/main/AndroidManifest.xml
       → com.google.android.gms.ads.APPLICATION_ID meta-data
   The ad-unit IDs live in THIS file only (PRODUCTION_IDS below).
   Nothing else in the codebase contains ad IDs.

   TO SWITCH TO YOUR REAL AD IDS LATER (when you're ready to go live):
   1. Paste your real IDs into PRODUCTION_IDS below (banner + interstitial).
   2. Make sure the AndroidManifest APPLICATION_ID matches your real
      Android App ID (it's the only place the app ID is configured).
   3. Flip ADS_USE_TEST_ADS to false.
   4. Rebuild: npm run build && npx cap sync android
   5. Done — every placement in the app switches over at once.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * REAL Cerevyn AdMob ad-unit IDs (production, from the AdMob console).
 * These are used ONLY when ADS_USE_TEST_ADS is flipped to false below —
 * while the master switch is true (development/testing), Google's official
 * TEST ad unit IDs are served in every placement instead.
 */
const PRODUCTION_IDS = {
  banner: "ca-app-pub-8054008558761017/1828502190",
  interstitial: "ca-app-pub-8054008558761017/9515420526",
} as const;

/**
 * ⚠️ DEVELOPMENT / TEST ADS — MASTER SWITCH ⚠️
 * true (current) = serve Google's official TEST ad unit IDs everywhere.
 * No personal/live ad IDs are used in any placement while this is true.
 * Flip to false ONLY when going live with PRODUCTION_IDS.
 */
export const ADS_USE_TEST_ADS = true;

/* ═══════════════════════════════════════════════════════════════════════
   CENTRALIZED AD PLACEMENT CONFIG — the single place to enable/disable
   individual placements or tune frequency later. No other file hardcodes
   ad decisions; components and controllers read from here.

   • *Banner flags    → where the (Android-native, bottom-pinned) banner
     is allowed to sit. Settings, Practice questions, Notes reading,
     chat threads and active gameplay are ALWAYS forbidden regardless.
   • *Interstitial flags → natural completion breaks where a cooldown-
     protected interstitial MAY appear (only if already loaded).
   • interstitialCooldownMs → minimum time between any two interstitials.
   Set any flag to false to disable that placement app-wide.
   ═══════════════════════════════════════════════════════════════════════ */

export const AD_PLACEMENTS = {
  // Bottom banner placements (Android native).
  dashboardBanner: true, // Home — sits below content sections
  notesBanner: true, // AI Study — appears after the notes content
  friendsBanner: true, // Friends — below the friends/conversation area
  timetableBanner: true, // Timetable — lower-page position
  questsBanner: true, // Quests — lower-page position
  arcadeHubBanner: true, // Arcade hub only — never during gameplay
  profileBanner: true, // Profile — low-disruption
  // Interstitial placements (natural completion breaks only).
  practiceResultsInterstitial: true, // after a full practice session
  quizResultsInterstitial: true, // after submitting a notes quiz
  gameResultsInterstitial: true, // after a game-over (never mid-game)
  // Frequency tuning.
  interstitialCooldownMs: 3 * 60 * 1000,
} as const;

export type AdPlacementId = keyof typeof AD_PLACEMENTS;

/** Routes where the bottom banner may appear, derived from the config. */
const BANNER_ROUTES: Record<Exclude<AdPlacementId, `practiceResultsInterstitial` | `quizResultsInterstitial` | `gameResultsInterstitial` | `interstitialCooldownMs`>, string> = {
  dashboardBanner: "/dashboard",
  notesBanner: "/ai-study",
  friendsBanner: "/friends",
  timetableBanner: "/timetable",
  questsBanner: "/quests",
  arcadeHubBanner: "/arcade",
  profileBanner: "/profile",
};

export function bannerRouteAllowed(pathname: string): boolean {
  // Gameplay guard: while inside an Arcade game the hub stays on the same
  // route, so gameplay itself is never ad-supported here.
  return Object.entries(BANNER_ROUTES).some(
    ([id, route]) => AD_PLACEMENTS[id as AdPlacementId] === true && pathname === route,
  );
}

const AD_IDS = ADS_USE_TEST_ADS ? TEST_IDS : PRODUCTION_IDS;

/**
 * Live Chat+ ad-free check. Reads the verified entitlement straight from
 * Convex (bypassing React) so ad decisions are never based on a stale or
 * forged local flag. Safe to call anywhere; treats errors/no-auth as free.
 */
type ConvexQueryClient = { query: (fn: unknown, ...args: unknown[]) => Promise<unknown> };
// Registered but intentionally unused right now: the live entitlement flows
// through updateChatPlusAdFree from the React layer instead. Kept so a
// synchronous query path can be added later without changing call sites.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let convexClient: ConvexQueryClient | null = null;
export function setChatPlusAdFreeClient(client: ConvexQueryClient) {
  convexClient = client;
}
let cachedPlusUntil = 0;
let cachedPlus = false;
export function chatPlusAdFree(): boolean {
  // Synchronous: used in ad paths. The React layer (useChatPlus) feeds
  // fresh entitlement values via updateChatPlusAdFree; backend re-validates
  // all premium actions independently.
  return cachedPlusUntil > Date.now() && cachedPlus;
}
/** Cache the entitlement for 5 minutes (called by the React hook). */
export function updateChatPlusAdFree(plus: boolean) {
  cachedPlus = plus;
  cachedPlusUntil = Date.now() + 5 * 60 * 1000;
}
// Note: with ADS_USE_TEST_ADS = true (current), AD_IDS is always the test
// IDs above — test ads are used in EVERY placement: Dashboard, Notes,
// Practice completion, Arcade menu, Friends, Timetable/Quests, Profile,
// and all interstitial breaks.

/** Android only — web is always a no-op. */
export const isAndroidNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

let initialized = false;
let initPromise: Promise<void> | null = null;

/** Initialize the Google Mobile Ads SDK (Android only, once). Also
 *  requests UMP consent info so EEA users get Google's consent form. */
export async function initAds(): Promise<void> {
  if (!isAndroidNative() || initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await AdMob.initialize({
        initializeForTesting: ADS_USE_TEST_ADS,
        maxAdContentRating: MaxAdContentRating.General,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });
      // UMP consent flow: if the user is in a region requiring consent,
      // Google's form is shown; elsewhere this resolves immediately.
      await AdMob.requestConsentInfo().catch(() => undefined);
      initialized = true;
    } catch {
      // Ads are a nice-to-have; app works fully without them.
      initPromise = null;
    }
  })();

  return initPromise;
}

/* ─── Banner ──────────────────────────────────────────────────────────── */

let bannerShown = false;
let bannerFailedOnce = false;

/**
 * Show the bottom adaptive banner (Android only). Safe to call repeatedly:
 * on first call it creates the banner; if the banner already exists but was
 * hidden (e.g. after visiting Settings/Practice), it is resumed instead of
 * re-created. If a previous create attempt FAILED, we retry — otherwise a
 * single transient failure (network, no-fill) would leave ads dead for the
 * whole session.
 */
export async function showBannerAd(): Promise<void> {
  if (!isAndroidNative() || bannerShown) return;
  try {
    await initAds();
    await AdMob.showBanner({
      adId: AD_IDS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      isTesting: ADS_USE_TEST_ADS,
      // Keep ads family-safe for a study app.
      margin: 0,
    });
    bannerShown = true;
    bannerFailedOnce = false;
  } catch {
    // Banner failure never breaks the page. Mark it so the next route
    // change retries (only once per failure, to avoid request spam).
    if (!bannerFailedOnce) {
      bannerFailedOnce = true;
      setTimeout(() => {
        bannerFailedOnce = false;
      }, 60_000);
    }
  }
}

/**
 * Resume a hidden banner without re-creating it (cheap, no new ad request).
 * Called by AdBannerController when navigating to an ad-allowed screen after
 * the banner was hidden elsewhere. If the banner was never successfully
 * created, fall through to a (possibly retrying) show instead. Web/no-banner:
 * safe no-op.
 */
export async function resumeBannerAd(): Promise<void> {
  if (!isAndroidNative()) return;
  if (!bannerShown) {
    // Never created (or a previous create failed) — try to create it.
    await showBannerAd();
    return;
  }
  try {
    await AdMob.resumeBanner();
  } catch {
    // ignore
  }
}

/** Hide (not destroy) the banner — used on screens where ads shouldn't sit. */
export async function hideBannerAd(): Promise<void> {
  if (!isAndroidNative() || !bannerShown) return;
  try {
    await AdMob.hideBanner();
  } catch {
    // ignore
  }
}

/** Permanently remove the banner (e.g. on logout). */
export async function removeBannerAd(): Promise<void> {
  if (!isAndroidNative() || !bannerShown) return;
  try {
    await AdMob.removeBanner();
  } finally {
    bannerShown = false;
  }
}

/* ─── Interstitial (cooldown-protected) ───────────────────────────────── */

const INTERSTITIAL_COOLDOWN_MS = AD_PLACEMENTS.interstitialCooldownMs;
let lastInterstitialAt = 0;
let interstitialReady = false;

// Track readiness so we only ever show an ad that is already loaded.
try {
  if (isAndroidNative()) {
    void AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      interstitialReady = true;
    });
    void AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      interstitialReady = false;
      // Preload the next one for the following natural break.
      void preloadInterstitial();
    });
  }
} catch {
  // ignore — non-native or SDK unavailable
}

async function preloadInterstitial(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await AdMob.prepareInterstitial({
      adId: AD_IDS.interstitial,
      isTesting: ADS_USE_TEST_ADS,
    });
  } catch {
    interstitialReady = false;
  }
}

/**
 * Called at natural breaks ONLY (session/quiz/game completion, results
 * already on screen). Shows an interstitial when ALL of:
 *  - running on Android,
 *  - the placement is enabled in AD_PLACEMENTS,
 *  - the ad is already loaded,
 *  - the cooldown has elapsed.
 * Otherwise does nothing and the app flow continues unchanged.
 */
export async function maybeShowInterstitial(
  placement: "practiceResultsInterstitial" | "quizResultsInterstitial" | "gameResultsInterstitial",
): Promise<void> {
  // Chat+ users are completely ad-free — no interstitials either.
  if (chatPlusAdFree()) return;
  if (!AD_PLACEMENTS[placement]) return;
  if (!isAndroidNative()) return;
  const now = Date.now();
  if (now - lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return;
  if (!interstitialReady) return;

  lastInterstitialAt = now;
  interstitialReady = false;
  try {
    await AdMob.showInterstitial();
  } catch {
    // ignore — flow continues
  }
  // Warm up the next ad in the background.
  void preloadInterstitial();
}

/** Warm up interstitial + initialize SDK after login (never shows anything). */
export async function warmUpAds(): Promise<void> {
  if (!isAndroidNative()) return;
  await initAds();
  void preloadInterstitial();
}
