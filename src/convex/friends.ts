import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./identity";

/* ─── Public user info (no emails / private data) ────────────────────────── */

type PublicInfo = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  school: string | null;
};

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/** Load public info for a set of user ids (profiles table, by_user index). */
async function publicInfoForProfiles(
  ctx: QueryCtx,
  userIds: string[],
): Promise<Map<string, PublicInfo>> {
  const out = new Map<string, PublicInfo>();
  for (const userId of userIds) {
    if (out.has(userId)) continue;
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    out.set(userId, {
      userId,
      username: p?.username ?? null,
      displayName: p?.displayName ?? null,
      avatar: p?.avatar ?? null,
      school: p?.school ?? null,
    });
  }
  return out;
}

/** Relationship state per user: none / pending_out / pending_in / friends. */
async function relationshipStates(
  ctx: QueryCtx,
  me: string,
): Promise<Map<string, "none" | "pending_out" | "pending_in" | "friends">> {
  const states = new Map<string, "none" | "pending_out" | "pending_in" | "friends">();
  const sent = await ctx.db
    .query("friendRequests")
    .withIndex("by_from_status", (q) => q.eq("fromId", me).eq("status", "pending"))
    .collect();
  for (const r of sent) states.set(r.toId, "pending_out");
  const received = await ctx.db
    .query("friendRequests")
    .withIndex("by_to_status", (q) => q.eq("toId", me).eq("status", "pending"))
    .collect();
  for (const r of received) states.set(r.fromId, "pending_in");
  const fa = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", me))
    .collect();
  for (const f of fa) states.set(f.userB, "friends");
  const fb = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", me))
    .collect();
  for (const f of fb) states.set(f.userA, "friends");
  return states;
}

/* ─── Username sync (Clerk → Learnova profile) ───────────────────────────── */

/**
 * Sync the signed-in user's username into their Learnova profile.
 * Called from the app shell with the Clerk client user object.
 * - If Clerk provides a username, it wins (validated + uniqueness enforced).
 * - Otherwise the profile keeps whatever it already has.
 * Never deletes or overwrites with empty values — existing users are safe.
 */
export const syncUsername = mutation({
  args: {
    clerkUsername: v.optional(v.string()),
    displayName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<"ok" | "taken" | "invalid"> => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const patch: { displayName?: string; avatar?: string; username?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.displayName && !existing?.displayName) {
      patch.displayName = args.displayName.trim().slice(0, 60);
    }
    if (args.imageUrl && !existing?.avatar) {
      patch.avatar = args.imageUrl;
    }

    let result: "ok" | "taken" | "invalid" = "ok";
    if (args.clerkUsername) {
      const uname = normalizeUsername(args.clerkUsername);
      if (USERNAME_RE.test(uname)) {
        if (existing?.username !== uname) {
          const taken = await ctx.db
            .query("profiles")
            .filter((q) => q.eq(q.field("username"), uname))
            .first();
          if (taken && taken.userId !== userId) {
            result = "taken"; // keep old username, don't clobber the profile
          } else {
            patch.username = uname;
          }
        }
      } else {
        result = "invalid";
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("profiles", {
        userId,
        displayName: patch.displayName,
        username: patch.username,
        avatar: patch.avatar,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return result;
  },
});

/* ─── Search ─────────────────────────────────────────────────────────────── */

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<PublicInfo & { requestState: "none" | "pending_out" | "pending_in" | "friends" }>
  > => {
    const me = await requireUserId(ctx);
    const q = normalizeUsername(args.query);
    if (q.length < 2) return [];

    const all = await ctx.db.query("profiles").collect();
    const matches = all
      .filter((p) => p.username && p.userId !== me)
      .filter((p) => (p.username as string).includes(q))
      .slice(0, 12);

    const states = await relationshipStates(ctx, me);
    return matches.map((p) => ({
      userId: p.userId,
      username: p.username ?? null,
      displayName: p.displayName ?? null,
      avatar: p.avatar ?? null,
      school: p.school ?? null,
      requestState: states.get(p.userId) ?? "none",
    }));
  },
});

/** My profile's public info (Friends header + username-setup prompt). */
export const me = query({
  args: {},
  handler: async (ctx): Promise<PublicInfo & { hasUsername: boolean }> => {
    const userId = await requireUserId(ctx);
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      userId,
      username: p?.username ?? null,
      displayName: p?.displayName ?? null,
      avatar: p?.avatar ?? null,
      school: p?.school ?? null,
      hasUsername: !!p?.username,
    };
  },
});

/* ─── Requests ───────────────────────────────────────────────────────────── */

export const sendRequest = mutation({
  args: { toId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<"sent" | "already_friends" | "already_pending" | "self"> => {
    const me = await requireUserId(ctx);
    if (args.toId === me) return "self";

    // Existing friendship? (normalized pair lookup)
    const [userA, userB] = me < args.toId ? [me, args.toId] : [args.toId, me];
    const fa = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", userA))
      .collect();
    if (fa.some((f) => f.userB === userB)) return "already_friends";

    // Any pending request between the two (either direction)?
    const sent = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_status", (q) => q.eq("fromId", me).eq("status", "pending"))
      .collect();
    if (sent.some((r) => r.toId === args.toId)) return "already_pending";
    const received = await ctx.db
      .query("friendRequests")
      .withIndex("by_to_status", (q) => q.eq("toId", me).eq("status", "pending"))
      .collect();
    if (received.some((r) => r.fromId === args.toId)) return "already_pending";

    // A previously declined request does not block a fresh attempt.
    await ctx.db.insert("friendRequests", {
      fromId: me,
      toId: args.toId,
      status: "pending",
      createdAt: Date.now(),
    });
    return "sent";
  },
});

export const listRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const incoming = (
      await ctx.db
        .query("friendRequests")
        .withIndex("by_to_status", (q) => q.eq("toId", me).eq("status", "pending"))
        .collect()
    ).map((r) => ({ _id: r._id, userId: r.fromId, direction: "in" as const, createdAt: r.createdAt }));
    const outgoing = (
      await ctx.db
        .query("friendRequests")
        .withIndex("by_from_status", (q) => q.eq("fromId", me).eq("status", "pending"))
        .collect()
    ).map((r) => ({ _id: r._id, userId: r.toId, direction: "out" as const, createdAt: r.createdAt }));

    const ids = [...incoming.map((r) => r.userId), ...outgoing.map((r) => r.userId)];
    const infos = await publicInfoForProfiles(ctx, ids);
    const decorate = <T extends { userId: string }>(r: T) => ({
      ...r,
      user: infos.get(r.userId) ?? null,
    });
    return {
      incoming: incoming.map(decorate),
      outgoing: outgoing.map(decorate),
    };
  },
});

export const respondRequest = mutation({
  args: { requestId: v.id("friendRequests"), accept: v.boolean() },
  handler: async (ctx, args): Promise<"accepted" | "declined" | "not_found"> => {
    const me = await requireUserId(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.toId !== me || req.status !== "pending") return "not_found";

    await ctx.db.patch(req._id, {
      status: args.accept ? "accepted" : "declined",
      respondedAt: Date.now(),
    });
    if (!args.accept) return "declined";

    // Create friendship (normalized pair) + one private conversation.
    const [userA, userB] = req.fromId < me ? [req.fromId, me] : [me, req.fromId];
    const fa = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", userA))
      .collect();
    if (!fa.some((f) => f.userB === userB)) {
      await ctx.db.insert("friendships", { userA, userB, createdAt: Date.now() });
    }
    const conv = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
      .first();
    if (!conv) {
      await ctx.db.insert("conversations", { userA, userB, createdAt: Date.now() });
    }
    return "accepted";
  },
});

export const removeFriend = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const [userA, userB] = args.userId < me ? [args.userId, me] : [me, args.userId];
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", userA))
      .collect();
    for (const f of rows.filter((f) => f.userB === userB)) await ctx.db.delete(f._id);
    // Conversation + history are kept, but sendMessage re-checks the
    // friendship live, so messaging is locked again immediately.
  },
});

export const friendsList = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const a = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", me))
      .collect();
    const b = await ctx.db
      .query("friendships")
      .withIndex("by_userB", (q) => q.eq("userB", me))
      .collect();
    const friendIds = [...a.map((f) => f.userB), ...b.map((f) => f.userA)];
    const infos = await publicInfoForProfiles(ctx, friendIds);
    return friendIds.map((id) => ({ userId: id, user: infos.get(id) ?? null }));
  },
});
