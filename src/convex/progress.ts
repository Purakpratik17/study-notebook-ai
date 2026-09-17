import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/* ─── Progress insights for the Dashboard (Phase 1, item 5) ──────────────── */

export const insights = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    quizAccuracy: number | null;
    practiceAccuracy: number | null;
    completedTopics: number;
    weakTopics: Array<{ topic: string; percent: number }>;
    strongTopics: Array<{ topic: string; percent: number }>;
  }> => {
    const userId = await requireUserId(ctx);

    // Quiz accuracy across all attempts.
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    let quizPoints = 0;
    let quizTotal = 0;
    for (const a of attempts) {
      quizPoints += a.score;
      quizTotal += a.total;
    }

    // Practice accuracy + per-topic accuracy from completed sessions.
    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    let practicePoints = 0;
    let practiceTotal = 0;
    const byTopic = new Map<string, { points: number; total: number }>();
    let completedTopics = 0;
    for (const s of sessions) {
      if (s.status !== "completed" || s.answers === undefined) continue;
      completedTopics++;
      practicePoints += s.score ?? 0;
      practiceTotal += s.total;
      const t = byTopic.get(s.topic) ?? { points: 0, total: 0 };
      t.points += s.score ?? 0;
      t.total += s.total;
      byTopic.set(s.topic, t);
    }

    const topics = Array.from(byTopic.entries())
      .filter(([, v]) => v.total >= 5) // enough questions to be meaningful
      .map(([topic, v]) => ({ topic, percent: Math.round((v.points / v.total) * 100) }))
      .sort((a, b) => a.percent - b.percent);

    const pct = (p: number, t: number) => (t > 0 ? Math.round((p / t) * 100) : null);

    return {
      quizAccuracy: pct(quizPoints, quizTotal),
      practiceAccuracy: pct(practicePoints, practiceTotal),
      completedTopics,
      weakTopics: topics.slice(0, 3),
      strongTopics: topics.slice(-3).reverse(),
    };
  },
});

/* ─── Subject → Chapter → Topic position memory ──────────────────────────── */

/** Remember the user's latest position in a chapter/topic. */
export const setPosition = mutation({
  args: {
    subject: v.string(),
    chapter: v.string(),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("studyPositions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existing = rows.find(
      (r) => r.subject === args.subject && r.chapter === args.chapter,
    );
    if (existing) {
      await ctx.db.patch(existing._id, { topic: args.topic, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("studyPositions", {
        userId,
        subject: args.subject,
        chapter: args.chapter,
        topic: args.topic,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Latest positions (newest first) for "continue where you left off" chips. */
export const positions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("studyPositions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  },
});
