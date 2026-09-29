import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/* ═══════════════════════════════════════════════════════════════════════
   MY NOTES — self-created rich-text notes (authored from scratch, as
   opposed to AI-generated notes in `notes`). Content is a sanitized HTML
   string rendered by the My Notes editor. Ownership enforced everywhere.
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_CONTENT = 200_000; // ~200 KB of HTML per note

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("myNotes")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  },
});

export const get = query({
  args: { id: v.id("myNotes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) return null; // ownership enforced
    return note;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    template: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    return ctx.db.insert("myNotes", {
      userId,
      title: args.title.trim().slice(0, 120) || "Untitled note",
      content: (args.content ?? "").slice(0, MAX_CONTENT),
      template: args.template,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Autosave target — content only; never touches title (rename is separate). */
export const save = mutation({
  args: { id: v.id("myNotes"), content: v.string(), template: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) throw new Error("Note not found");
    await ctx.db.patch(args.id, {
      content: args.content.slice(0, MAX_CONTENT),
      template: args.template,
      updatedAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { id: v.id("myNotes"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) throw new Error("Note not found");
    await ctx.db.patch(args.id, {
      title: args.title.trim().slice(0, 120) || "Untitled note",
      updatedAt: Date.now(),
    });
  },
});

export const setFolder = mutation({
  args: { id: v.id("myNotes"), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) throw new Error("Note not found");
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== userId)
        throw new Error("Folder not found");
    }
    await ctx.db.patch(args.id, { folderId: args.folderId, updatedAt: Date.now() });
  },
});

export const duplicate = mutation({
  args: { id: v.id("myNotes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) throw new Error("Note not found");
    const now = Date.now();
    return ctx.db.insert("myNotes", {
      userId,
      title: `${note.title} (copy)`.slice(0, 120),
      content: note.content,
      template: note.template,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("myNotes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) throw new Error("Note not found");
    await ctx.db.delete(args.id);
  },
});
