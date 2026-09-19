import { useLocation } from "react-router";
import { useEffect, useState } from "react";
import {
  bannerRouteAllowed,
  isAndroidNative,
} from "@/lib/ads";
import { useChatPlus } from "@/hooks/use-chat-plus";

/**
 * Whether the native Android bottom banner is (or will be) visible on the
 * current route. The AppShell consumes this to reserve real layout space
 * above the banner so it can never cover the bottom navigation or content.
 *
 * Chat+ users are completely ad-free: this always returns false for them,
 * so no ad space is reserved and content expands naturally.
 *
 * Always false on web — zero layout impact in the browser preview.
 */
export function useBannerMargin(): boolean {
  const { pathname } = useLocation();
  const { plus, isLoading } = useChatPlus();
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    const native = isAndroidNative();
    const allowed = bannerRouteAllowed(pathname);
    setBannerVisible(native && allowed && !isLoading && !plus);
  }, [pathname, plus, isLoading]);

  return bannerVisible;
}
