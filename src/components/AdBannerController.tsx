import { useEffect } from "react";
import { useLocation } from "react-router";
import { hideBannerAd, isAndroidNative, showBannerAd, warmUpAds } from "@/lib/ads";
import { useSettings } from "@/hooks/use-settings";

/* ═══════════════════════════════════════════════════════════════════════
   AdBannerController — native (Android) bottom banner controller.

   The actual banner is a NATIVE view pinned to the bottom of the Android
   screen by the AdMob SDK — it is not DOM, so it can never overlay or
   block React navigation/content beyond reserving its strip at the very
   bottom edge. We hide it on screens where ads must not appear
   (Practice questions, Curated Notes reading, auth) and on web it is a
   complete no-op (nothing renders, nothing loads).
   ═════════════════════════════════════════════════════════════════════ */

/** Screens where banners are allowed (low-disruption, non-study focus). */
const BANNER_ALLOWED = new Set(["/dashboard", "/profile", "/settings"]);

/** Screens where ads must never appear. */
const BANNER_FORBIDDEN = new Set([
  "/ai-study",
  "/practice",
  "/auth",
  "/sign-up",
  "/sso-callback",
]);

export function AdBannerController() {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const adsEnabled = settings.adsEnabled !== false;

  useEffect(() => {
    if (!isAndroidNative() || !adsEnabled) return;

    const allowed =
      BANNER_ALLOWED.has(pathname) && !BANNER_FORBIDDEN.has(pathname);
    if (allowed) {
      void showBannerAd();
    } else {
      void hideBannerAd();
    }
  }, [pathname, adsEnabled]);

  // Respect the OFF toggle and clean up on unmount.
  useEffect(() => {
    if (!isAndroidNative()) return;
    if (!adsEnabled) void hideBannerAd();
  }, [adsEnabled]);

  // Warm up the SDK + preload an interstitial once per session (Android only).
  // Nothing is ever SHOWN at startup — this only loads in the background.
  useEffect(() => {
    if (!isAndroidNative() || !adsEnabled) return;
    void warmUpAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null; // native banner; no DOM output
}
