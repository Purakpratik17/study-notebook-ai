import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/* ─── Private 1:1 chat over accepted friendships ─────────────────────────── */

async function areFriends(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  a: string,
  b: string,
): Promise<boolean> {
  const [userA, userB] = a < b ? [a, b] : [b, a];
  const rows = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userA))
    .collect();
  return rows.some((f) => f.userB === userB);
}

/** All conversations for the current user, with friend info + unread counts. */
export const list = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      conversationId: string;
      friendId: string;
      username: string | null;
      displayName: string | null;
      avatar: string | null;
      lastMessage: string | null;
      lastMessageAt: number | null;
      unread: number;
    }>
  > => {
    const me = await requireUserId(ctx);
    const a = await ctx.db
      .query("conversations")
      .withIndex("by_userA", (q) => q.eq("userA", me))
      .collect();
    const b = await ctx.db
      .query("conversations")
      .withIndex("by_userB", (q) => q.eq("userB", me))
      .collect();

    const out = [];
    for (const conv of [...a, ...b]) {
      const friendId = conv.userA === me ? conv.userB : conv.userA;
      // Live friendship check — removed friends keep history but are filtered
      // out of the chat list and cannot be messaged.
      if (!(await areFriends(ctx, me, friendId))) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", friendId))
        .first();
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .take(50);
      const last = msgs[0] ?? null;
      const unread = msgs.filter((m) => m.senderId !== me && !m.readAt).length;
      out.push({
        conversationId: conv._id,
        friendId,
        username: profile?.username ?? null,
        displayName: profile?.displayName ?? null,
        avatar: profile?.avatar ?? null,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.createdAt ?? conv.createdAt,
        unread,
      });
    }
    return out.sort((x, y) => (y.lastMessageAt ?? 0) - (x.lastMessageAt ?? 0));
  },
});

/** Messages of one conversation — participants only (server-enforced). */
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) {
      throw new Error("Conversation not found.");
    }
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .order("asc")
      .take(200);
    return rows.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === me,
    }));
  },
});

/** Send a message — only inside an accepted friendship (server-enforced). */
export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  handler: async (ctx, args): Promise<"sent" | "not_friends"> => {
    const me = await requireUserId(ctx);
    const body = args.body.trim().slice(0, 1000);
    if (!body) throw new Error("Message is empty.");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) {
      throw new Error("Conversation not found.");
    }
    const friendId = conv.userA === me ? conv.userB : conv.userA;
    if (!(await areFriends(ctx, me, friendId))) return "not_friends";
    await ctx.db.insert("messages", {
      conversationId: conv._id,
      senderId: me,
      body,
      createdAt: Date.now(),
    });
    return "sent";
  },
});

/** Mark all of the friend's messages in a conversation as read. */
export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) return;
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .order("desc")
      .take(100);
    const now = Date.now();
    for (const m of unread) {
      if (m.senderId !== me && !m.readAt) await ctx.db.patch(m._id, { readAt: now });
    }
  },
});
