import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { isChatPlus, MEDIA_LIMITS } from "./chatPlus";
import { enforceRateLimit, RATE_LIMITS } from "./rateLimit";

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
      // Hide conversations I blocked (either direction still shows a hint? no —
      // fully hidden for the blocker; the blocked user still sees it read-only).
      const iBlocked = conv.userA === me ? conv.blockedByUserA : conv.blockedByUserB;
      if (iBlocked) continue;
      // Live friendship check — removed friends keep history but are filtered
      // out of the chat list and cannot be messaged.
      if (!(await areFriends(ctx, me, friendId))) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", friendId))
        .first();
      const friendPlus = await isChatPlus(ctx, friendId);
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
        lastMessage:
          last?.body ||
          (last?.kind === "image" ? "📷 Photo" : last?.kind === "video" ? "🎥 Video" : null),
        lastMessageAt: last?.createdAt ?? conv.createdAt,
        unread,
        friendPlus,
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
    const friendId = conv.userA === me ? conv.userB : conv.userA;
    const friendPlus = await isChatPlus(ctx, friendId);
    return rows.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === me,
      kind: m.kind ?? null,
      mediaType: m.mediaType ?? null,
      durationSec: m.durationSec ?? null,
      fileName: m.fileName ?? null,
      fileSize: m.fileSize ?? null,
      friendPlus,
    }));
  },
});

/** Send a message — only inside an accepted friendship (server-enforced). */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
    kind: v.optional(
      v.union(v.literal("image"), v.literal("video"), v.literal("file")),
    ),
    storageId: v.optional(v.id("_storage")),
    mediaType: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    fileName: v.optional(v.string()), // Chat+ file attachments
    fileSize: v.optional(v.number()),
    shareId: v.optional(v.id("shares")), // study-material share card
  },
  handler: async (ctx, args): Promise<"sent" | "not_friends" | "blocked"> => {
    const me = await requireUserId(ctx);
    // Spam protection (server-side).
    await enforceRateLimit(ctx, `chat:${me}`, RATE_LIMITS.chat.limit, RATE_LIMITS.chat.windowMs);
    const body = args.body.trim().slice(0, 1000);
    const hasMedia = !!args.kind && !!args.storageId;
    if (!body && !hasMedia) throw new Error("Message is empty.");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) {
      throw new Error("Conversation not found.");
    }
    const friendId = conv.userA === me ? conv.userB : conv.userA;
    if (!(await areFriends(ctx, me, friendId))) return "not_friends";
    // Blocked conversations reject new messages (either side can block).
    const blocked = conv.userA === me ? conv.blockedByUserA : conv.blockedByUserB;
    const blockedMe = conv.userA === me ? conv.blockedByUserB : conv.blockedByUserA;
    if (blocked || blockedMe) return "blocked";

    // Server-side media validation (cannot be bypassed by the frontend).
    let kind: "image" | "video" | "file" | undefined;
    if (hasMedia) {
      kind = args.kind!;
      const plus = await isChatPlus(ctx, me);
      const limits = plus ? MEDIA_LIMITS.plus : MEDIA_LIMITS.free;
      const meta = await ctx.storage.getMetadata(args.storageId!);
      if (!meta) throw new Error("Attachment upload not found.");
      const isImage = kind === "image";
      const isVideo = kind === "video";
      const isFile = kind === "file";
      const mimeOk = isImage
        ? (meta.contentType ?? "").startsWith("image/")
        : isVideo
          ? (meta.contentType ?? "").startsWith("video/")
          : true; // files: any type, size-checked
      if (!mimeOk) throw new Error("Invalid attachment type.");
      if (isFile && !plus) throw new Error("Chat+ is required to send files.");
      const max = isImage ? limits.maxImage : isVideo ? limits.maxVideo : limits.maxFile;
      if (meta.size > max) {
        throw new Error(
          isImage
            ? plus
              ? "Images must be 25 MB or smaller."
              : "Images must be 5 MB or smaller."
            : isVideo
              ? plus
                ? "Videos must be 500 MB or smaller."
                : "Videos must be 100 MB or smaller."
              : "Files must be 100 MB or smaller.",
        );
      }
      if (
        isVideo &&
        (args.durationSec === undefined || args.durationSec > limits.maxVideoDurationSec)
      ) {
        throw new Error(
          plus ? "Videos must be 1 hour or shorter." : "Videos must be 3 minutes or shorter.",
        );
      }
    }

    await ctx.db.insert("messages", {
      conversationId: conv._id,
      senderId: me,
      body,
      kind,
      storageId: hasMedia ? args.storageId : undefined,
      mediaType: hasMedia ? args.mediaType : undefined,
      durationSec: kind === "video" ? args.durationSec : undefined,
      fileName:
        args.kind === "file" ? sanitizeFileName(args.fileName) : undefined,
      fileSize: args.kind === "file" ? args.fileSize : undefined,
      shareId: args.shareId,
      createdAt: Date.now(),
    });
    return "sent";
  },
});

/**
 * Short-lived URL for a chat attachment. Only conversation participants can
 * fetch it — private media is never exposed publicly.
 */
export const getMediaUrl = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args): Promise<string | null> => {
    const me = await requireUserId(ctx);
    const m = await ctx.db.get(args.messageId);
    if (!m || !m.storageId) return null;
    const conv = await ctx.db.get(m.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) return null;
    return await ctx.storage.getUrl(m.storageId);
  },
});

/** Upload URL for chat attachments (image or ≤3-min video). Rate-limited. */
export const generateMediaUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    await enforceRateLimit(ctx, `upload:${me}`, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowMs);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Sanitize a client-provided file name: strip path-lookalike separators
 * and control characters, cap length. Purely cosmetic — actual content
 * access is storage-id based, never filename based, so there is no
 * traversal risk.
 */
function sanitizeFileName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .replace(/[\\/]/g, "_")
    // eslint-disable-next-line no-control-regex -- intentional: stripping control chars
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 120);
  return cleaned || undefined;
}

/** Mute or unmute a conversation (only affects your own notifications). */
export const setMuted = mutation({
  args: { conversationId: v.id("conversations"), muted: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) return;
    await ctx.db.patch(conv._id, {
      ...(conv.userA === me ? { mutedByUserA: args.muted } : { mutedByUserB: args.muted }),
    });
  },
});

/** Block or unblock the other participant. Blocking hides the chat and rejects sends. */
export const setBlocked = mutation({
  args: { conversationId: v.id("conversations"), blocked: v.boolean() },
  handler: async (ctx, args): Promise<"ok" | "not_found"> => {
    const me = await requireUserId(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) return "not_found";
    await ctx.db.patch(conv._id, {
      ...(conv.userA === me ? { blockedByUserA: args.blocked } : { blockedByUserB: args.blocked }),
    });
    return "ok";
  },
});

/** My per-conversation mute/block state (for thread header + chat list). */
export const getConvState = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || (conv.userA !== me && conv.userB !== me)) return null;
    const mine = conv.userA === me;
    return {
      muted: Boolean(mine ? conv.mutedByUserA : conv.mutedByUserB),
      blocked: Boolean(mine ? conv.blockedByUserA : conv.blockedByUserB),
      blockedMe: Boolean(mine ? conv.blockedByUserB : conv.blockedByUserA),
    };
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
