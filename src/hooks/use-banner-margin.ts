import { useLocation } from "react-router";
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
  // Derived directly from inputs — no state/effect, so no cascading renders.
  // isAndroidNative() is a stable platform check (constant per session).
  return isAndroidNative() && bannerRouteAllowed(pathname) && !isLoading && !plus;
}
