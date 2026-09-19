import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useCallback, useEffect } from "react";
import { updateChatPlusAdFree } from "@/lib/ads";

/**
 * Chat+ entitlement hook. The Convex backend (`chatPlus.getEntitlement`)
 * is the source of truth — this never trusts a local "isPremium" flag.
 * Free limits vs Chat+ limits are mirrored client-side for UX, but the
 * server re-validates every send.
 */
export const CHAT_PLUS_LIMITS = {
  free: { image: 5 * 1024 * 1024, video: 100 * 1024 * 1024, videoSec: 180, file: 0 },
  plus: { image: 25 * 1024 * 1024, video: 500 * 1024 * 1024, videoSec: 3600, file: 100 * 1024 * 1024 },
};

export function useChatPlus() {
  // Convex auth gate: `useConvexAuth().isAuthenticated` only turns true once
  // the Clerk JWT has been validated by Convex. While auth is loading (or
  // the user is signed out) the entitlement query is SKIPPED — protected
  // Convex functions must never run without an authenticated identity.
  // This is the fix for the "UNAUTHENTICATED: sign in with Clerk…" crash
  // that fired at app start: this hook is mounted at the root (via
  // AdBannerController / useBannerMargin), before RequireAuth completes.
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const entitlement = useQuery(
    api.chatPlus.getEntitlement,
    isAuthenticated ? {} : "skip",
  );

  // Feed the ad-free cache used by the native ad controllers.
  useEffect(() => {
    if (entitlement !== undefined) updateChatPlusAdFree(Boolean(entitlement.plus));
  }, [entitlement]);

  const plus = Boolean(entitlement?.plus);
  const limits = plus ? CHAT_PLUS_LIMITS.plus : CHAT_PLUS_LIMITS.free;

  const describeExpiry = useCallback(() => {
    if (!entitlement?.expiresAt) return null;
    const d = new Date(entitlement.expiresAt);
    return d.toLocaleDateString();
  }, [entitlement?.expiresAt]);

  return {
    plus,
    // Loading only while auth is initializing or the (authorized) query is
    // still in flight — signed-out users resolve to free immediately.
    isLoading: authLoading || (isAuthenticated && entitlement === undefined),
    limits,
    expiresAt: entitlement?.expiresAt ?? null,
    describeExpiry,
    priceDisplay: entitlement?.config.priceDisplay ?? "₹99",
    yearlyDisplay: entitlement?.config.yearlyDisplay ?? "₹499",
  };
}
