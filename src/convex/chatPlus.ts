import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireUserId } from "./identity";

/* ─── Chat+ subscription (backend is the source of truth) ────────────────── */

/** Centralized product config — change price/product id here. */
export const CHAT_PLUS_CONFIG = {
  productId: "chat_plus_monthly",
  priceDisplay: "₹99",
  yearlyProductId: "chat_plus_yearly",
  yearlyDisplay: "₹499",
  yearlyMinorUnits: 49900, // ₹499.00 in paise
  priceMinorUnits: 9900, // ₹99.00 in paise
  billingPeriod: "1 month",
  currency: "INR",
};

/** Server-side media limits. Free vs Chat+ tiers. */
export const MEDIA_LIMITS = {
  free: {
    maxImage: 5 * 1024 * 1024, // 5 MB
    maxVideo: 100 * 1024 * 1024, // 100 MB
    maxVideoDurationSec: 181, // 3 min + 1s grace
    maxFile: 0, // files are Chat+ only
  },
  plus: {
    maxImage: 25 * 1024 * 1024, // 25 MB
    maxVideo: 500 * 1024 * 1024, // 500 MB
    maxVideoDurationSec: 3600, // 1 hour technical cap, no 3-min restriction
    maxFile: 100 * 1024 * 1024, // 100 MB files
  },
};

/**
 * Is the caller's Chat+ entitlement active?
 * Backend-only helper — the frontend never decides this.
 */
export async function isChatPlus(ctx: {
  db: import("./_generated/server").QueryCtx["db"];
}, userId: string): Promise<boolean> {
  const now = Date.now();
  const rows = await ctx.db
    .query("chatPurchases")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return rows.some(
    (r) =>
      r.status === "active" &&
      r.expiresAt > now,
  );
}

/** My entitlement (query used by the UI; verification stays server-side). */
export const getEntitlement = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const active = await isChatPlus(ctx, me);
    const purchases = await ctx.db
      .query("chatPurchases")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    const current = purchases
      .filter((p) => p.status === "active")
      .sort((a, b) => b.expiresAt - a.expiresAt)[0];
    return {
      plus: active,
      expiresAt: current?.expiresAt ?? null,
      autoRenewing: current?.autoRenewing ?? false,
      productId: current?.productId ?? null,
      config: CHAT_PLUS_CONFIG,
    };
  },
});

/** My chat settings (Chat+ customizations; readable by free users too). */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const s = await ctx.db
      .query("chatSettings")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    return (
      s ?? {
        userId: me,
        bubbleColor: "default",
        wallpaper: "none",
        messageSound: true,
        notifyNewMessages: true,
        autoDownloadMedia: true,
        updatedAt: 0,
      }
    );
  },
});

/**
 * Update my chat settings. Chat+ customizations (bubbleColor, wallpaper)
 * are only applied if the caller is Chat+ at save time; free-tier prefs
 * (sound / notifications / auto-download) are always allowed.
 */
export const setSettings = mutation({
  args: {
    bubbleColor: v.optional(v.string()),
    wallpaper: v.optional(v.string()),
    messageSound: v.optional(v.boolean()),
    notifyNewMessages: v.optional(v.boolean()),
    autoDownloadMedia: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const plus = await isChatPlus(ctx, me);
    const existing = await ctx.db
      .query("chatSettings")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    // Premium-only customizations are gated server-side.
    if (args.bubbleColor !== undefined) {
      if (!plus) return "plus_required";
      patch.bubbleColor = args.bubbleColor.slice(0, 32);
    }
    if (args.wallpaper !== undefined) {
      if (!plus) return "plus_required";
      patch.wallpaper = args.wallpaper.slice(0, 32);
    }
    if (args.messageSound !== undefined) patch.messageSound = args.messageSound;
    if (args.notifyNewMessages !== undefined) patch.notifyNewMessages = args.notifyNewMessages;
    if (args.autoDownloadMedia !== undefined) patch.autoDownloadMedia = args.autoDownloadMedia;
    if (existing) await ctx.db.patch(existing._id, patch);
    else
      await ctx.db.insert("chatSettings", {
        userId: me,
        ...patch,
      } as never);
    return "ok";
  },
});

/**
 * Report a Google Play purchase. This is called from the app after
 * `BillingClient` acknowledges a purchase. The token is verified via
 * playBilling.verifyPurchase (a "use node" action) before the entitlement
 * is granted — a crafted client call cannot grant Chat+.
 */

/*
 * Google Play purchase verification lives in playBilling.ts (a "use node"
 * action file) — Convex requires node actions to be in their own file.
 * Internal helpers below are called from there.
 */

/* Internal helpers used by playBilling.ts actions. */

export const getPurchaseByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatPurchases")
      .withIndex("by_token", (q) => q.eq("purchaseToken", args.token))
      .first();
  },
});

export const listPurchasesFor = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatPurchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const insertPurchase = internalMutation({
  args: {
    userId: v.string(),
    productId: v.string(),
    purchaseToken: v.string(),
    orderId: v.optional(v.string()),
    expiresAt: v.number(),
    autoRenewing: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatPurchases", {
      userId: args.userId,
      productId: args.productId,
      purchaseToken: args.purchaseToken,
      orderId: args.orderId,
      status: "active",
      expiresAt: args.expiresAt,
      autoRenewing: args.autoRenewing,
      verifiedAt: Date.now(),
    });
  },
});

export const patchPurchase = internalMutation({
  args: {
    purchaseId: v.id("chatPurchases"),
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("canceled"),
    ),
    expiresAt: v.number(),
    autoRenewing: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.purchaseId, {
      status: args.status,
      expiresAt: args.expiresAt,
      autoRenewing: args.autoRenewing,
      verifiedAt: Date.now(),
    });
  },
});

export const markExpired = internalMutation({
  args: { purchaseId: v.id("chatPurchases") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.purchaseId, { status: "expired" });
  },
});
