import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/* ═══════════════════════════════════════════════════════════════════════
   WHITEBOARDS — per-user study boards.

   Every function resolves the caller from the Clerk JWT (requireUserId)
   and filters/validates ownership server-side. One user can never read,
   modify, or delete another user's board.
   ═══════════════════════════════════════════════════════════════════════ */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("whiteboards")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100)
      .map((b) => ({
        _id: b._id,
        title: b.title,
        updatedAt: b.updatedAt,
        elementCount: b.elements.length,
      }));
  },
});

export const get = query({
  args: { id: v.id("whiteboards") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const board = await ctx.db.get(args.id);
    if (!board || board.userId !== userId) return null; // ownership enforced
    return board;
  },
});

export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    return ctx.db.insert("whiteboards", {
      userId,
      title: args.title.trim().slice(0, 120) || "Untitled board",
      elements: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { id: v.id("whiteboards"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const board = await ctx.db.get(args.id);
    if (!board || board.userId !== userId)
      throw new Error("NOT_FOUND or not yours");
    await ctx.db.patch(args.id, {
      title: args.title.trim().slice(0, 120) || "Untitled board",
      updatedAt: Date.now(),
    });
  },
});

/** Debounced autosave target. Replaces the full element list — the client
 *  keeps the canonical document, the server just persists it. */
export const save = mutation({
  args: {
    id: v.id("whiteboards"),
    elements: v.array(
      v.object({
        id: v.string(),
        type: v.string(),
        points: v.optional(v.array(v.array(v.number()))),
        x: v.optional(v.number()),
        y: v.optional(v.number()),
        x2: v.optional(v.number()),
        y2: v.optional(v.number()),
        color: v.string(),
        size: v.number(),
        text: v.optional(v.string()),
        fontSize: v.optional(v.number()),
        opacity: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const board = await ctx.db.get(args.id);
    if (!board || board.userId !== userId)
      throw new Error("NOT_FOUND or not yours");
    // Hard cap to protect the deployment from oversized documents.
    if (args.elements.length > 3000) {
      throw new Error("Board is too large to save (max 3000 elements)");
    }
    await ctx.db.patch(args.id, {
      elements: args.elements,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("whiteboards") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const board = await ctx.db.get(args.id);
    if (!board || board.userId !== userId)
      throw new Error("NOT_FOUND or not yours");
    await ctx.db.delete(args.id);
  },
});
