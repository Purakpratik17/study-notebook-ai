import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import type { Id } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════════
   SHARES — chat sharing of study material (AI notes, personal notes,
   whiteboards, quizzes).

   SECURITY MODEL
   • A share row records sender + material pointer + destination
     (conversation OR group). The material itself stays in its
     owner-scoped table — never copied for sharing.
   • Access to open a share is granted ONLY to the conversation
     participants or group members, re-validated server-side on every
     open. Frontend checks are never trusted.
   • Recipients get READ access only. The sender's original is never
     writable through a share; "Save a copy" inserts a NEW row owned by
     the recipient.
   ═══════════════════════════════════════════════════════════════════════ */

type AnyCtx = {
  db: import("./_generated/server").QueryCtx["db"];
};

async function isParticipant(
  ctx: AnyCtx,
  conversationId: import("./_generated/dataModel").Id<"conversations">,
  userId: string,
): Promise<boolean> {
  const conv = await ctx.db.get(conversationId);
  return !!conv && (conv.userA === userId || conv.userB === userId);
}

async function isGroupMember(
  ctx: AnyCtx,
  groupId: import("./_generated/dataModel").Id<"groups">,
  userId: string,
): Promise<boolean> {
  const group = await ctx.db.get(groupId);
  return !!group && group.members.includes(userId);
}

/**
 * Share a material into a conversation or group. The sender must OWN the
 * material and be an authorized participant of the destination.
 */
export const share = mutation({
  args: {
    targetType: v.union(
      v.literal("ai_note"),
      v.literal("my_note"),
      v.literal("whiteboard"),
      v.literal("quiz"),
    ),
    targetId: v.string(),
    conversationId: v.optional(v.id("conversations")),
    groupId: v.optional(v.id("groups")),
    messageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    if (!args.conversationId && !args.groupId)
      throw new Error("Share needs a destination");
    if (args.conversationId && args.groupId)
      throw new Error("Share must target a conversation OR a group");

    // Sender must own the material; fetch its title for the card.
    let title = "";
    if (args.targetType === "ai_note") {
      const row = await ctx.db.get(args.targetId as Id<"notes">);
      if (!row || row.userId !== me) throw new Error("Material not found");
      title = row.topic;
    } else if (args.targetType === "quiz") {
      const row = await ctx.db.get(args.targetId as Id<"notes">);
      if (!row || row.userId !== me) throw new Error("Material not found");
      title = row.topic;
    } else if (args.targetType === "my_note") {
      const row = await ctx.db.get(args.targetId as Id<"myNotes">);
      if (!row || row.userId !== me) throw new Error("Material not found");
      title = row.title;
    } else {
      const row = await ctx.db.get(args.targetId as Id<"whiteboards">);
      if (!row || row.userId !== me) throw new Error("Material not found");
      title = row.title;
    }

    // Sender must be authorized in the destination chat.
    if (args.conversationId) {
      if (!(await isParticipant(ctx, args.conversationId, me)))
        throw new Error("Not a participant of this conversation");
    } else if (args.groupId) {
      if (!(await isGroupMember(ctx, args.groupId, me)))
        throw new Error("Not a member of this group");
    }

    return ctx.db.insert("shares", {
      senderId: me,
      targetType: args.targetType,
      targetId: args.targetId,
      title,
      conversationId: args.conversationId,
      groupId: args.groupId,
      messageId: args.messageId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Card data for a share attached to a chat message. Only participants
 * of the share's destination (or the sender) may read it.
 */
export const getByMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const share = await ctx.db
      .query("shares")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();
    if (!share) return null;
    let authorized = share.senderId === me;
    if (!authorized && share.conversationId)
      authorized = await isParticipant(ctx, share.conversationId, me);
    if (!authorized && share.groupId)
      authorized = await isGroupMember(ctx, share.groupId, me);
    if (!authorized) return null;
    const sender = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", share.senderId))
      .first();
    return {
      _id: share._id,
      targetType: share.targetType,
      targetId: share.targetId,
      title: share.title,
      senderId: share.senderId,
      mine: share.senderId === me,
      senderName: sender?.displayName ?? sender?.username ?? "Cerevyn student",
      createdAt: share.createdAt,
    };
  },
});

/**
 * The full, permission-checked payload for opening a shared material.
 * Read-only — includes material content but never grants write access.
 */
export const open = query({
  args: { shareId: v.id("shares") },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) return null;

    // Viewer must be the sender OR an authorized recipient.
    const isSender = share.senderId === me;
    let authorized = isSender;
    if (!authorized && share.conversationId) {
      authorized = await isParticipant(ctx, share.conversationId, me);
    }
    if (!authorized && share.groupId) {
      authorized = await isGroupMember(ctx, share.groupId, me);
    }
    if (!authorized) return null; // silently hidden, never an error leak

    let content: unknown = null;
    let meta: Record<string, unknown> = {};
    if (share.targetType === "ai_note") {
      const row = await ctx.db.get(share.targetId as Id<"notes">);
      if (!row) return null;
      content = row.notes; // AI notes structure
      meta = { topic: row.topic };
    } else if (share.targetType === "quiz") {
      const row = await ctx.db.get(share.targetId as Id<"notes">);
      if (!row) return null;
      content = row.quiz;
      meta = { topic: row.topic };
    } else if (share.targetType === "my_note") {
      const row = await ctx.db.get(share.targetId as Id<"myNotes">);
      if (!row) return null;
      content = row.content;
      meta = { title: row.title, template: row.template };
    } else {
      const row = await ctx.db.get(share.targetId as Id<"whiteboards">);
      if (!row) return null;
      content = row.elements;
      meta = { title: row.title };
    }

    const sender = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", share.senderId))
      .first();

    return {
      share: {
        _id: share._id,
        senderId: share.senderId,
        targetType: share.targetType,
        targetId: share.targetId,
        title: share.title,
        createdAt: share.createdAt,
      },
      mine: isSender,
      senderName: sender?.displayName ?? sender?.username ?? "Cerevyn student",
      content,
      meta,
    };
  },
});

/** All shares I have RECEIVED in chats I belong to (Shared With Me). */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    const all = await ctx.db.query("shares").collect(); // shares are small rows
    const out = [];
    for (const s of all) {
      if (s.senderId === me) continue;
      let ok = false;
      if (s.conversationId) ok = await isParticipant(ctx, s.conversationId, me);
      else if (s.groupId) ok = await isGroupMember(ctx, s.groupId, me);
      if (!ok) continue;
      const sender = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", s.senderId))
        .first();
      out.push({
        _id: s._id,
        targetType: s.targetType,
        targetId: s.targetId,
        title: s.title,
        senderId: s.senderId,
        senderName: sender?.displayName ?? sender?.username ?? "Cerevyn student",
        createdAt: s.createdAt,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** All shares I have SENT (Shared By Me). */
export const sharedByMe = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUserId(ctx);
    return ctx.db
      .query("shares")
      .withIndex("by_sender", (q) => q.eq("senderId", me))
      .order("desc")
      .collect();
  },
});

/**
 * Save an independent, fully-owned copy of a shared material. The copy is a
 * NEW row keyed to the recipient — the sender's original is untouched.
 */
export const saveCopy = mutation({
  args: { shareId: v.id("shares") },
  handler: async (ctx, args): Promise<"saved" | "not_authorized" | "missing"> => {
    const me = await requireUserId(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) return "missing";

    let authorized = share.senderId === me;
    if (!authorized && share.conversationId) {
      authorized = await isParticipant(ctx, share.conversationId, me);
    }
    if (!authorized && share.groupId) {
      authorized = await isGroupMember(ctx, share.groupId, me);
    }
    if (!authorized) return "not_authorized";

    const now = Date.now();
    if (share.targetType === "my_note") {
      const row = await ctx.db.get(share.targetId as Id<"myNotes">);
      if (!row) return "missing";
      await ctx.db.insert("myNotes", {
        userId: me,
        title: `${row.title} (saved copy)`.slice(0, 120),
        content: row.content,
        template: row.template,
        createdAt: now,
        updatedAt: now,
      });
    } else if (share.targetType === "whiteboard") {
      const row = await ctx.db.get(share.targetId as Id<"whiteboards">);
      if (!row) return "missing";
      await ctx.db.insert("whiteboards", {
        userId: me,
        title: `${row.title} (saved copy)`.slice(0, 120),
        folderId: undefined,
        elements: row.elements,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // ai_note / quiz — both resolve to a notes row (quiz lives inside it).
      const row = await ctx.db.get(share.targetId as Id<"notes">);
      if (!row) return "missing";
      await ctx.db.insert("notes", {
        userId: me,
        topic: row.topic,
        notes: row.notes,
        quiz: row.quiz,
        createdAt: now,
      });
    }
    return "saved";
  },
});
