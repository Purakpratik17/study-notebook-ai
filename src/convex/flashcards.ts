import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireUserId } from "./identity";
import { chatCompletion, extractJson } from "./ai";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";
import { XP_REWARDS } from "./data";

const MAX_CARDS = 400;

/* ─── Generate flashcards from an existing AI note ───────────────────────── */

export const generateFromNote = action({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args): Promise<{ created: number }> => {
    const userId = await requireUserId(ctx);
    const note = await ctx.runQuery(api.notes.get, { noteId: args.noteId });
    if (!note) throw new Error("Note not found.");

    const existingCount = (
      await ctx.runQuery(api.flashcards.listInternal, { userId })
    ).length;
    if (existingCount >= MAX_CARDS) {
      throw new Error("Flashcard limit reached. Remove some cards first.");
    }

    const content = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Cerevyn, an expert study assistant. Respond with a single valid JSON object only — no markdown fences, no commentary.",
        },
        {
          role: "user",
          content: `Create 8 high-quality flashcards from these study notes on "${note.topic}".

Return ONLY valid JSON matching this TypeScript type:
{
  "cards": [ { "front": string, "back": string } ]
}

Rules:
- "front": a short question, term or prompt (max 120 chars).
- "back": the clear, complete answer (max 300 chars).
- Cover the most examinable ideas; include definitions and formulas.
- No duplicates. Be concise.`,
        },
      ],
      0.4,
      1600,
    );

    const parsed = extractJson(content) as { cards?: unknown };
    const cards = Array.isArray(parsed.cards)
      ? (parsed.cards as Array<Record<string, unknown>>)
          .filter((c) => typeof c?.front === "string" && typeof c?.back === "string")
          .map((c) => ({ front: String(c.front).slice(0, 200), back: String(c.back).slice(0, 500) }))
      : [];
    if (cards.length === 0) throw new Error("AI response was incomplete. Try again.");

    const created = await ctx.runMutation(internal.flashcards.insertAiCards, {
      userId,
      noteId: args.noteId,
      topic: note.topic,
      cards,
    });
    return { created };
  },
});

export const listInternal = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/** Idempotent insert of AI cards — dedupe key prevents duplicates. */
export const insertAiCards = internalMutation({
  args: {
    userId: v.string(),
    noteId: v.id("notes"),
    topic: v.string(),
    cards: v.array(v.object({ front: v.string(), back: v.string() })),
  },
  handler: async (ctx, args): Promise<number> => {
    let created = 0;
    for (let i = 0; i < args.cards.length; i++) {
      const dedupeKey = `ai:${args.noteId}:${i}:${args.cards[i].front.slice(0, 60)}`;
      const dup = await ctx.db
        .query("flashcards")
        .withIndex("by_dedupe", (q) =>
          q.eq("userId", args.userId).eq("dedupeKey", dedupeKey),
        )
        .first();
      if (dup) continue;
      await ctx.db.insert("flashcards", {
        userId: args.userId,
        topic: args.topic,
        noteId: args.noteId,
        front: args.cards[i].front,
        back: args.cards[i].back,
        intervalDays: 0,
        ease: 2.2,
        nextDue: Date.now(),
        reviews: 0,
        lapses: 0,
        source: "ai",
        dedupeKey,
        createdAt: Date.now(),
      });
      created++;
    }
    return created;
  },
});

/* ─── Manual flashcards ──────────────────────────────────────────────────── */

export const create = mutation({
  args: {
    topic: v.string(),
    front: v.string(),
    back: v.string(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const front = args.front.trim().slice(0, 200);
    const back = args.back.trim().slice(0, 500);
    const topic = args.topic.trim().slice(0, 120) || "General";
    if (front.length < 1 || back.length < 1) {
      throw new Error("Front and back are both required.");
    }
    const count = (
      await ctx.db
        .query("flashcards")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).length;
    if (count >= MAX_CARDS) throw new Error("Flashcard limit reached.");
    return ctx.db.insert("flashcards", {
      userId,
      topic,
      subject: args.subject?.trim().slice(0, 60) || undefined,
      front,
      back,
      intervalDays: 0,
      ease: 2.2,
      nextDue: Date.now(),
      reviews: 0,
      lapses: 0,
      source: "manual",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("flashcards") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const card = await ctx.db.get(args.id);
    if (card && card.userId === userId) await ctx.db.delete(card._id);
  },
});

/* ─── Lists / revision queue ─────────────────────────────────────────────── */

export const list = query({
  args: { topic: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let rows = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (args.topic) rows = rows.filter((r) => r.topic === args.topic);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const due = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const sorted = rows.sort((a, b) => a.nextDue - b.nextDue);
    return {
      dueNow: sorted.filter((r) => r.nextDue <= now).slice(0, 30),
      upcoming: sorted.filter((r) => r.nextDue > now).slice(0, 10),
      total: rows.length,
      learned: rows.filter((r) => r.intervalDays >= 7).length,
      needsWork: rows.filter((r) => r.lapses > 0 && r.intervalDays < 7).length,
    };
  },
});

export const topics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.topic, (counts.get(r.topic) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);
  },
});

/* ─── Review with simple spaced repetition ───────────────────────────────── */

export const review = mutation({
  args: {
    cardId: v.id("flashcards"),
    rating: v.union(
      v.literal("again"),
      v.literal("hard"),
      v.literal("good"),
      v.literal("easy"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== userId) throw new Error("Card not found.");

    const now = Date.now();
    const DAY = 86_400_000;
    let { intervalDays, ease, lapses } = card;

    switch (args.rating) {
      case "again":
        intervalDays = 0; // review again within ~10 minutes
        ease = Math.max(1.3, ease - 0.2);
        lapses += 1;
        break;
      case "hard":
        intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
        ease = Math.max(1.3, ease - 0.05);
        break;
      case "good":
        intervalDays = intervalDays === 0 ? 1 : Math.round(intervalDays * ease);
        break;
      case "easy":
        intervalDays = intervalDays === 0 ? 3 : Math.round(intervalDays * ease * 1.3);
        ease = Math.min(2.5, ease + 0.1);
        break;
    }
    intervalDays = Math.min(Math.max(Math.round(intervalDays), 0), 365);

    await ctx.db.patch(card._id, {
      intervalDays,
      ease,
      lapses,
      reviews: card.reviews + 1,
      lastReviewedAt: now,
      // "again" cards come back in 10 minutes; others by interval.
      nextDue: intervalDays === 0 ? now + 10 * 60_000 : now + intervalDays * DAY,
    });

    await ctx.db.insert("flashcardReviews", {
      userId,
      cardId: card._id,
      rating: args.rating,
      createdAt: now,
    });

    return { nextDue: intervalDays === 0 ? now + 10 * 60_000 : now + intervalDays * DAY };
  },
});

/** Award XP for a completed review batch + quest progress. Idempotent per hour. */
export const completeReviewSession = mutation({
  args: { reviewed: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const reviewed = Math.min(Math.max(Math.round(args.reviewed), 1), 100);
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const ref = `flashreview:${new Date().toISOString().slice(0, 10)}:${hourBucket}`;

    await progressQuests(ctx, userId, "flashcards_reviewed", reviewed);
    const settled = await settleQuests(ctx, userId);

    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.FLASHCARD_REVIEW,
      `Reviewed ${reviewed} flashcards`,
    );
    return { xp, settledQuests: settled };
  },
});
