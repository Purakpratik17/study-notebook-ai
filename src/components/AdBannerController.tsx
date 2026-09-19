import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  bannerRouteAllowed,
  hideBannerAd,
  isAndroidNative,
  resumeBannerAd,
  showBannerAd,
  warmUpAds,
} from "@/lib/ads";
import { useSettings } from "@/hooks/use-settings";
import { useChatPlus } from "@/hooks/use-chat-plus";

/* ═══════════════════════════════════════════════════════════════════════
   AdBannerController — native (Android) bottom banner controller.

   The actual banner is a NATIVE view pinned to the bottom of the Android
   screen by the AdMob SDK — it is not DOM, so it can never overlay or
   block React navigation/content beyond reserving its strip at the very
   bottom edge. We hide it on screens where ads must not appear
   (Practice questions, Curated Notes reading, auth) and on web it is a
   complete no-op (nothing renders, nothing loads).
   ═════════════════════════════════════════════════════════════════════ */

/** Screens where ads must never appear, regardless of config. */
const BANNER_ALWAYS_FORBIDDEN = new Set([
  "/settings", // explicitly ad-free
  "/practice", // active studying
  "/auth",
  "/sign-up",
  "/sso-callback",
]);

export function AdBannerController() {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const { plus, isLoading: plusLoading } = useChatPlus();
  const adsEnabled = settings.adsEnabled !== false && !plusLoading && !plus;

  useEffect(() => {
    if (!isAndroidNative() || !adsEnabled) return;

    const allowed =
      bannerRouteAllowed(pathname) && !BANNER_ALWAYS_FORBIDDEN.has(pathname);
    if (allowed) {
      // If the banner already exists (created earlier in the session) this
      // just un-hides it; otherwise it creates it for the first time.
      void resumeBannerAd().then(() => showBannerAd());
    } else {
      void hideBannerAd();
    }
  }, [pathname, adsEnabled]);

  // Respect the OFF toggle, Chat+ entitlement, and clean up on unmount.
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
