import { useQuery } from "convex/react";
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
  const entitlement = useQuery(api.chatPlus.getEntitlement);

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
    isLoading: entitlement === undefined,
    limits,
    expiresAt: entitlement?.expiresAt ?? null,
    describeExpiry,
    priceDisplay: entitlement?.config.priceDisplay ?? "₹99",
    yearlyDisplay: entitlement?.config.yearlyDisplay ?? "₹499",
  };
}
