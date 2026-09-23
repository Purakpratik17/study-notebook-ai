import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { requireUserId } from "./identity";
import { getOrCreateStats } from "./stats";
import { levelForXp } from "./data";

/* ═══════════════════════════════════════════════════════════════════════
   ADMIN PANEL — backend-enforced authorization.

   Authorization model:
   • The admin allowlist lives in src/lib/admin-config.ts and contains
     Clerk user IDs (identity.subject values).
   • EVERY admin query/mutation re-derives the caller's identity from the
     Clerk JWT on the Convex server (requireUserId) and checks it against
     the allowlist. Nothing is trusted from the client.
   • A non-admin who calls any admin function gets an authorization
     error — the function never touches data.
   • The frontend nav entry is a convenience only; the real protection
     is this file.
   ═══════════════════════════════════════════════════════════════════════ */

// NOTE: src/lib/admin-config.ts is deliberately dependency-free (no DOM
// APIs) so it can be imported from Convex server code as well as the app.
import { ADMIN_USER_IDS } from "../lib/admin-config";

/** Backend-enforced admin check: derives the caller's identity from the
 *  Clerk JWT, then matches against the user-ID allowlist OR resolves the
 *  caller's own profile username against the username allowlist. */
async function assertAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<string> {
  const userId = await requireUserId(ctx);
  if (!ADMIN_USER_IDS.includes(userId)) {
    throw new Error(
      "FORBIDDEN: this function is restricted to Cerevyn administrators",
    );
  }
  return userId;
}

/* ─── Queries ────────────────────────────────────────────────────────── */

/** Is the signed-in user an admin? Used for nav visibility only — the
 *  backend enforces the same check independently on every call. */
export const isAdmin = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await requireUserId(ctx);
    return ADMIN_USER_IDS.includes(userId);
  },
});

/** Lightweight dashboard stats: total users + recent signups. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    assertAdmin(ctx);

    const profiles = await ctx.db.query("profiles").collect();
    const totalUsers = profiles.length;
    const recent = profiles
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((p) => ({
        userId: p.userId,
        username: p.username ?? p.displayName ?? "(no username)",
        createdAt: p.createdAt,
      }));
    return { totalUsers, recent };
  },
});

/** Search users by username (substring, case-insensitive). */
export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(ctx);
    const q = args.query.trim().toLowerCase();
    if (!q) return [];

    const profiles = await ctx.db.query("profiles").collect();
    const matches = profiles
      .filter(
        (p) =>
          (p.username ?? "").toLowerCase().includes(q) ||
          (p.displayName ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);

    const results = [];
    for (const p of matches) {
      const stats = await ctx.db
        .query("stats")
        .withIndex("by_user", (q2) => q2.eq("userId", p.userId))
        .first();
      const lvl = levelForXp(stats?.xp ?? 0);
      results.push({
        userId: p.userId,
        username: p.username ?? p.displayName ?? "(no username)",
        bio: p.bio ?? null,
        school: p.school ?? null,
        course: p.course ?? null,
        createdAt: p.createdAt,
        xp: stats?.xp ?? 0,
        level: lvl.level,
        levelName: lvl.name,
      });
    }
    return results;
  },
});

/** Recent admin audit entries (newest first), usernames resolved for
 *  display. No private data — usernames only. */
export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    assertAdmin(ctx);
    const entries = await ctx.db
      .query("adminAudit")
      .withIndex("by_created")
      .order("desc")
      .take(25);

    const profiles = await ctx.db.query("profiles").collect();
    const nameOf = (id: string) =>
      profiles.find((p) => p.userId === id)?.username ?? "(unknown)";

    return entries.map((e) => ({
      _id: e._id,
      adminName: nameOf(e.adminId),
      targetName: nameOf(e.targetUserId),
      action: e.action,
      amount: e.amount ?? null,
      previousXp: e.previousXp,
      newXp: e.newXp,
      createdAt: e.createdAt,
    }));
  },
});

/** Fetch a user's current XP/level before the admin commits a change. */
export const getUserXp = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(ctx);
    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const lvl = levelForXp(stats?.xp ?? 0);
    return {
      xp: stats?.xp ?? 0,
      level: lvl.level,
      levelName: lvl.name,
    };
  },
});

/* ─── XP management ──────────────────────────────────────────────────── */

/** Apply an XP change (add/remove/set/reset) using the EXISTING stats
 *  system so rank/level recalculates through levelForXp, and journal an
 *  audit entry. XP can never become negative. */
export const adjustXp = mutation({
  args: {
    userId: v.string(),
    action: v.union(
      v.literal("add"),
      v.literal("remove"),
      v.literal("set"),
      v.literal("reset"),
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await assertAdmin(ctx);

    if (!Number.isFinite(args.amount ?? 0)) {
      throw new Error("Invalid XP amount");
    }

    const stats = await getOrCreateStats(ctx, args.userId);
    const previousXp = stats.xp;
    let newXp: number;
    let delta: number | undefined;

    switch (args.action) {
      case "add": {
        delta = Math.floor(args.amount ?? 0);
        if (delta <= 0) throw new Error("Add amount must be a positive number");
        newXp = previousXp + delta;
        break;
      }
      case "remove": {
        delta = Math.floor(args.amount ?? 0);
        if (delta <= 0)
          throw new Error("Remove amount must be a positive number");
        newXp = Math.max(0, previousXp - delta); // never negative
        break;
      }
      case "set": {
        newXp = Math.floor(args.amount ?? 0);
        if (newXp < 0) throw new Error("XP cannot be negative");
        break;
      }
      case "reset": {
        newXp = 0;
        break;
      }
    }

    // Recalculate rank/level through the existing system.
    const lvl = levelForXp(newXp);
    await ctx.db.patch(stats._id, {
      xp: newXp,
      level: lvl.level,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("adminAudit", {
      adminId,
      targetUserId: args.userId,
      action: args.action,
      amount: delta,
      previousXp,
      newXp,
      createdAt: Date.now(),
    });

    return { previousXp, newXp, level: lvl.level, levelName: lvl.name };
  },
});

/* ─── Subscription management (admin-granted Premium) ─────────────────── */

/** Admin view of a user's subscription status. */
export const getSubscription = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("chatPurchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    // Active = paid (verified Google Play) OR admin-granted, not expired.
    const active = rows
      .filter((r) => r.status === "active" && r.expiresAt > now)
      .sort((a, b) => b.expiresAt - a.expiresAt)[0];
    if (!active) return { active: false as const };
    const grantedByProfile = active.grantedBy
      ? await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", active.grantedBy as string))
          .first()
      : null;
    return {
      active: true as const,
      plan: active.productId.includes("yearly") ? "Premium (yearly)" : "Premium",
      productId: active.productId,
      source: active.source ?? "payment", // legacy rows are real purchases
      grantedBy: active.grantedBy ?? null,
      grantedByName: grantedByProfile?.username ?? "—",
      grantedAt: active.verifiedAt,
      expiresAt: active.expiresAt,
      lifetime: active.expiresAt > now + 100 * 365 * 86_400_000,
    };
  },
});

const DAY = 86_400_000;

/** Grant Premium to a user. Admin-allowlist enforced; audited. */
export const grantSubscription = mutation({
  args: {
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("premium")),
    // Duration in days; 0 = lifetime. Custom dates are resolved client-side
    // into a days count so the backend stays simple.
    durationDays: v.number(),
  },
  handler: async (ctx, args) => {
    const adminId = await assertAdmin(ctx);
    if (args.durationDays < 0 || !Number.isFinite(args.durationDays)) {
      throw new Error("Invalid duration");
    }

    if (args.plan === "free") {
      // "Free" plan = revoke any active subscription, same as removal.
      return await revokeRows(ctx, adminId, args.userId);
    }

    const now = Date.now();
    const expiresAt =
      args.durationDays === 0
        ? now + 100 * 365 * DAY // lifetime
        : now + Math.round(args.durationDays) * DAY;

    // Deactivate any current admin-granted rows, then insert the new grant.
    const rows = await ctx.db
      .query("chatPurchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const r of rows) {
      if (r.source === "admin" && r.status === "active") {
        await ctx.db.patch(r._id, { status: "canceled" });
      }
    }

    await ctx.db.insert("chatPurchases", {
      userId: args.userId,
      productId: "admin_premium",
      // Unique synthetic token = idempotency key (re-grant creates a new row,
      // never collides with a real Play purchase).
      purchaseToken: `admin:${adminId}:${args.userId}:${now}`,
      status: "active",
      expiresAt,
      autoRenewing: false,
      verifiedAt: now,
      grantedBy: adminId,
      source: "admin",
    });

    await ctx.db.insert("adminAudit", {
      adminId,
      targetUserId: args.userId,
      action: "subscription_granted",
      amount: Math.round(args.durationDays),
      previousXp: 0,
      newXp: 0,
      createdAt: now,
    });

    return { expiresAt };
  },
});

/** Remove admin-granted Premium. Paid rows are never touched. */
export const removeSubscription = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const adminId = await assertAdmin(ctx);
    const changed = await revokeRows(ctx, adminId, args.userId);
    return changed;
  },
});

async function revokeRows(
  ctx: MutationCtx,
  adminId: string,
  userId: string,
): Promise<{ removed: number }> {
  const rows = await ctx.db
    .query("chatPurchases")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let removed = 0;
  for (const r of rows) {
    // Only admin-granted rows are revocable — real payments expire on their own.
    if (r.source === "admin" && r.status === "active") {
      await ctx.db.patch(r._id, { status: "canceled" });
      removed++;
    }
  }
  await ctx.db.insert("adminAudit", {
    adminId,
    targetUserId: userId,
    action: "subscription_removed",
    previousXp: 0,
    newXp: 0,
    createdAt: Date.now(),
  });
  return { removed };
}
