"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireUserId } from "./identity";
import { internal } from "./_generated/api";

/**
 * Google Play Billing verification (server-side only).
 *
 * The Android app calls `BillingClient` to purchase, then reports the
 * purchase token here. We verify it against the Google Play Developer API
 * using a service-account key stored in Convex env vars — never in the
 * client. A crafted client call cannot grant Chat+.
 */

const PLAY_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const VALID_STATES = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"];

type PlayVerifyResult =
  | { ok: true; expiresAt: number; autoRenewing: boolean }
  | { ok: false; reason: "invalid" | "not_configured" };

async function verifyWithGoogle(
  purchaseToken: string,
): Promise<PlayVerifyResult> {
  const svcEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!svcEmail || !svcKey || !packageName) return { ok: false, reason: "not_configured" };

  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: {
      client_email: svcEmail,
      private_key: svcKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const client = await auth.getClient();
  const response = await client.request<{
    subscriptionState?: string;
    lineItems?: Array<{
      expiryTime?: string;
      autoRenewingPlan?: { autoRenewEnabled?: boolean };
    }>;
  }>({
    url: `${PLAY_API}/applications/${packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
  });
  const data = response.data;
  const active = VALID_STATES.includes(data?.subscriptionState ?? "");
  const expiresAt = data?.lineItems?.[0]?.expiryTime
    ? new Date(data.lineItems[0].expiryTime).getTime()
    : 0;
  if (!active || expiresAt <= Date.now()) return { ok: false, reason: "invalid" };
  return {
    ok: true,
    expiresAt,
    autoRenewing: Boolean(data?.lineItems?.[0]?.autoRenewingPlan?.autoRenewEnabled),
  };
}

/** Report a purchase from the app (after BillingClient acknowledges it). */
export const verifyPurchase = action({
  args: {
    productId: v.string(),
    purchaseToken: v.string(),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<"ok" | "rejected" | "not_configured"> => {
    const me = await requireUserId(ctx);
    if (args.productId !== "chat_plus_monthly" && args.productId !== "chat_plus_yearly")
      return "rejected";

    const result = await verifyWithGoogle(args.purchaseToken).catch(
      (): PlayVerifyResult => ({ ok: false, reason: "invalid" }),
    );
    if (!result.ok) return result.reason === "not_configured" ? "not_configured" : "rejected";

    // Idempotent grant keyed on the unique purchase token.
    const existing = await ctx.runQuery(internal.chatPlus.getPurchaseByToken, {
      token: args.purchaseToken,
    });
    if (existing) {
      await ctx.runMutation(internal.chatPlus.patchPurchase, {
        purchaseId: existing._id,
        status: "active",
        expiresAt: result.expiresAt,
        autoRenewing: result.autoRenewing,
      });
    } else {
      await ctx.runMutation(internal.chatPlus.insertPurchase, {
        userId: me,
        productId: args.productId,
        purchaseToken: args.purchaseToken,
        orderId: args.orderId,
        expiresAt: result.expiresAt,
        autoRenewing: result.autoRenewing,
      });
    }
    return "ok";
  },
});

/** Re-verify active purchases (call on app open). Expires stale ones. */
export const refreshEntitlement = action({
  args: {},
  handler: async (ctx): Promise<"ok" | "not_configured"> => {
    const me = await requireUserId(ctx);
    const rows = await ctx.runQuery(internal.chatPlus.listPurchasesFor, { userId: me });
    for (const p of rows.filter((x) => x.status === "active")) {
      const result = await verifyWithGoogle(p.purchaseToken).catch(
        (): PlayVerifyResult => ({ ok: false, reason: "invalid" }),
      );
      if (!result.ok && p.expiresAt <= Date.now()) {
        await ctx.runMutation(internal.chatPlus.markExpired, { purchaseId: p._id });
      }
    }
    return "ok";
  },
});
