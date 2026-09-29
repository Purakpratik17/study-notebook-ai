import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/* ═══════════════════════════════════════════════════════════════════════
   FOLDERS — user-created organizational containers.

   Folders hold REFERENCES to materials (AI notes, personal notes,
   whiteboards, quizzes) — never copies. Deleting a folder removes only
   the folder row; every material's folderId reference becomes dangling,
   which the library treats as "no folder". Materials are untouched.
   Every function validates ownership server-side.
   ═══════════════════════════════════════════════════════════════════════ */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Folder name cannot be empty");
    const now = Date.now();
    return ctx.db.insert("folders", { userId, name, createdAt: now, updatedAt: now });
  },
});

export const rename = mutation({
  args: { id: v.id("folders"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) throw new Error("Folder not found");
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Folder name cannot be empty");
    await ctx.db.patch(args.id, { name, updatedAt: Date.now() });
  },
});

/**
 * Delete a folder WITHOUT touching its contents. Materials keep existing —
 * their folderId references are treated as unfiled by the library UI.
 */
export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const folder = await ctx.db.get(args.id);
    if (!folder || folder.userId !== userId) throw new Error("Folder not found");

    // Clear references only (never delete the referenced materials).
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const n of notes) {
      if (n.folderId === args.id) await ctx.db.patch(n._id, { folderId: undefined });
    }
    const boards = await ctx.db
      .query("whiteboards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const b of boards) {
      if (b.folderId === args.id) await ctx.db.patch(b._id, { folderId: undefined });
    }
    const myNotes = await ctx.db
      .query("myNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const n of myNotes) {
      if (n.folderId === args.id) await ctx.db.patch(n._id, { folderId: undefined });
    }

    await ctx.db.delete(args.id);
  },
});
