import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { isChatPlus, MEDIA_LIMITS } from "./chatPlus";
import type { Id } from "./_generated/dataModel";

/* ─── Group chats (members-only, server-enforced) ────────────────────────── */

/** Create a group with the owner + selected members. */
export const createGroup = mutation({
  args: { name: v.string(), memberIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ groupId: Id<"groups"> } | "empty_name"> => {
    const me = await requireUserId(ctx);
    const name = args.name.trim().slice(0, 60);
    if (!name) return "empty_name";
    // Owner + unique, non-self members.
    const members = Array.from(new Set(args.memberIds.filter((id) => id !== me)));
    const groupId = await ctx.db.insert("groups", {
      name,
      ownerId: me,
      members: [me, ...members],
      mutedBy: [],
      createdAt: Date.now(),
    });
    return { groupId };
  },
});

/** All groups I'm a member of, with unread counts + last message preview. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const all = await ctx.db.query("groups").collect();
    const mine = all.filter((g) => g.members.includes(me));

    const out = [];
    for (const g of mine) {
      const msgs = await ctx.db
        .query("groupMessages")
        .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
        .order("desc")
        .take(50);
      const last = msgs[0] ?? null;
      const unread = msgs.filter((m) => m.senderId !== me && !m.readBy?.includes(me)).length;
      out.push({
        groupId: g._id,
        name: g.name,
        memberCount: g.members.length,
        ownerId: g.ownerId,
        muted: (g.mutedBy ?? []).includes(me),
        lastMessage:
          last?.body ||
          (last?.kind === "image" ? "📷 Photo" : last?.kind === "video" ? "🎥 Video" : null),
        lastMessageAt: last?.createdAt ?? g.createdAt,
        lastSender: last?.senderId ?? null,
        unread,
      });
    }
    return out.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** Messages of one group — members only (server-enforced). */
export const getMessages = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return null;
    const rows = await ctx.db
      .query("groupMessages")
      .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
      .order("asc")
      .take(300);
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
    }));
  },
});

/** Send a group message — members only. */
export const send = mutation({
  args: {
    groupId: v.id("groups"),
    body: v.string(),
    kind: v.optional(
      v.union(v.literal("image"), v.literal("video"), v.literal("file")),
    ),
    storageId: v.optional(v.id("_storage")),
    mediaType: v.optional(v.string()),
    durationSec: v.optional(v.number()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<"sent" | "not_member"> => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return "not_member";
    const body = args.body.trim().slice(0, 1000);
    const hasMedia = !!args.kind && !!args.storageId;
    if (!body && !hasMedia) throw new Error("Message is empty.");

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
          : true;
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

    await ctx.db.insert("groupMessages", {
      groupId: g._id,
      senderId: me,
      body,
      kind,
      storageId: hasMedia ? args.storageId : undefined,
      mediaType: hasMedia ? args.mediaType : undefined,
      durationSec: kind === "video" ? args.durationSec : undefined,
      fileName: args.kind === "file" ? args.fileName : undefined,
      fileSize: args.kind === "file" ? args.fileSize : undefined,
      readBy: [me],
      createdAt: Date.now(),
    });
    return "sent";
  },
});

/** Mark all of the group's messages as read for me. */
export const markRead = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return;
    const unread = await ctx.db
      .query("groupMessages")
      .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
      .order("desc")
      .take(100);
    for (const m of unread) {
      if (!m.readBy?.includes(me)) {
        await ctx.db.patch(m._id, { readBy: [...(m.readBy ?? []), me] });
      }
    }
  },
});

/** Mute or unmute a group for me only. */
export const setMuted = mutation({
  args: { groupId: v.id("groups"), muted: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return;
    const set = new Set(g.mutedBy ?? []);
    if (args.muted) set.add(me);
    else set.delete(me);
    await ctx.db.patch(g._id, { mutedBy: [...set] });
  },
});

/** Leave a group (owner leaving deletes it if they're the only member). */
export const leave = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return;
    const remaining = g.members.filter((m) => m !== me);
    if (g.ownerId === me && remaining.length === 0) {
      // Last member out — clean up.
      const msgs = await ctx.db
        .query("groupMessages")
        .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
        .collect();
      for (const m of msgs) await ctx.db.delete(m._id);
      await ctx.db.delete(g._id);
      return;
    }
    await ctx.db.patch(g._id, { members: remaining, mutedBy: (g.mutedBy ?? []).filter((m) => m !== me) });
  },
});

/** Public info for group members (thread header + sender names). */
export const memberInfo = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g || !g.members.includes(me)) return null;
    const infos: Record<
      string,
      { username: string | null; displayName: string | null; avatar: string | null; plus: boolean }
    > = {};
    for (const id of g.members) {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .first();
      infos[id] = {
        username: p?.username ?? null,
        displayName: p?.displayName ?? null,
        avatar: p?.avatar ?? null,
        plus: await isChatPlus(ctx, id),
      };
    }
    return { name: g.name, ownerId: g.ownerId, members: infos, meId: me };
  },
});

/** Media URL — group members only. */
export const getMediaUrl = query({
  args: { messageId: v.id("groupMessages") },
  handler: async (ctx, args): Promise<string | null> => {
    const me = await requireUserId(ctx);
    const m = await ctx.db.get(args.messageId);
    if (!m || !m.storageId) return null;
    const g = await ctx.db.get(m.groupId);
    if (!g || !g.members.includes(me)) return null;
    return await ctx.storage.getUrl(m.storageId);
  },
});

/** Upload URL for group attachments. */
export const generateMediaUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
