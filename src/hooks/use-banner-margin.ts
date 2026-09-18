import { useLocation } from "react-router";
import { useEffect, useState } from "react";
import {
  bannerRouteAllowed,
  isAndroidNative,
} from "@/lib/ads";

/**
 * Whether the native Android bottom banner is (or will be) visible on the
 * current route. The AppShell consumes this to reserve real layout space
 * above the banner so it can never cover the bottom navigation or content.
 *
 * Always false on web — zero layout impact in the browser preview.
 */
export function useBannerMargin(): boolean {
  const { pathname } = useLocation();
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const native = isAndroidNative();
    const allowed = bannerRouteAllowed(pathname);
    setBannerVisible(native && allowed);
  }, [pathname]);

  return bannerVisible;
}
