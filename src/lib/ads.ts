import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
} from "@capacitor-community/admob";

/* ═══════════════════════════════════════════════════════════════════════
   Learnova ads — Google AdMob via @capacitor-community/admob (Android).

   Platform rules:
   - Native SDK calls happen ONLY on Android (Capacitor.isNativePlatform()).
   - On web (Vite dev/preview/build) every function is a safe no-op, so the
     web app never crashes and never loads the native SDK.
   - TEST ad unit IDs (Google's official sample IDs) are used while
     initializeForTesting is true. Swap PRODUCTION ids below when going
     live — no other application code changes.
   - No personal data (Clerk credentials, emails, study content, Convex
     data) is ever passed to the ad SDK.
   ═════════════════════════════════════════════════════════════════════ */

/** Google's official always-test ad unit IDs — safe for development. */
const TEST_IDS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
} as const;

/** TODO: Replace with real AdMob ad unit IDs before releasing to Play. */
const PRODUCTION_IDS = {
  banner: "ca-app-pub-XXXX/YYYY-BANNER",
  interstitial: "ca-app-pub-XXXX/YYYY-INTERSTITIAL",
} as const;

/**
 * Master switch. While true, every ad request uses TEST ads.
 * Flip to false only when PRODUCTION_IDS above are real and the app is
 * release-ready. Kept explicit so dev builds can never serve real ads.
 */
export const ADS_USE_TEST_ADS = true;

const AD_IDS = ADS_USE_TEST_ADS ? TEST_IDS : PRODUCTION_IDS;

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

/** Show the bottom adaptive banner (Android only). Safe to call repeatedly. */
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
  } catch {
    // Banner failure never breaks the page.
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

const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // min 3 min between interstitials
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
 * Called at natural breaks (e.g. right after a Practice session completes,
 * results already on screen). Shows an interstitial only when ALL of:
 *  - running on Android,
 *  - the ad is already loaded,
 *  - the cooldown (3 min) has elapsed.
 * Otherwise does nothing and the app flow continues unchanged.
 */
export async function maybeShowInterstitial(): Promise<void> {
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
