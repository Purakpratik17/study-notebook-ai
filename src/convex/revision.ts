import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";
import { XP_REWARDS, todayISO } from "./data";

/**
 * Revision queue: everything a student should revisit, assembled from real
 * user data — overdue/due flashcards, unresolved quiz mistakes, and weak
 * topics. No static/fake data.
 */
export const queue = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    overdueCards: number;
    dueTodayCards: number;
    upcomingCards: number;
    mistakes: Array<{
      _id: string;
      topic: string;
      question: string;
      options: Array<string>;
      correctIndex: number;
      explanation?: string;
    }>;
    weakTopics: Array<{ topic: string; percent: number }>;
    total: number;
  }> => {
    const userId = await requireUserId(ctx);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const overdue = cards.filter((c) => c.nextDue < new Date().setHours(0, 0, 0, 0)).length;
    const dueToday = cards.filter(
      (c) => c.nextDue > new Date().setHours(0, 0, 0, 0) && c.nextDue <= endOfToday.getTime(),
    ).length;

    const mistakes = (
      await ctx.db
        .query("quizMistakes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    )
      .filter((m) => !m.resolved)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((m) => ({
        _id: m._id,
        topic: m.topic,
        question: m.question,
        options: m.options,
        correctIndex: m.correctIndex,
        explanation: m.explanation,
      }));

    // Weak topics from recent practice sessions (accuracy < 70%).
    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);
    const byTopic = new Map<string, { points: number; total: number }>();
    for (const s of sessions) {
      if (s.status !== "completed" || s.answers === undefined) continue;
      const t = byTopic.get(s.topic) ?? { points: 0, total: 0 };
      t.points += s.score ?? 0;
      t.total += s.total;
      byTopic.set(s.topic, t);
    }
    const weakTopics = Array.from(byTopic.entries())
      .filter(([, v]) => v.total >= 5 && v.points / v.total < 0.7)
      .map(([topic, v]) => ({ topic, percent: Math.round((v.points / v.total) * 100) }))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 5);

    return {
      overdueCards: overdue,
      dueTodayCards: dueToday,
      upcomingCards: cards.filter((c) => c.nextDue > endOfToday.getTime()).length,
      mistakes,
      weakTopics,
      total: overdue + dueToday + mistakes.length,
    };
  },
});

/** Answer a previously-missed quiz question during revision. */
export const answerMistake = mutation({
  args: {
    mistakeId: v.id("quizMistakes"),
    choiceIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const m = await ctx.db.get(args.mistakeId);
    if (!m || m.userId !== userId) throw new Error("Question not found.");
    const correct = args.choiceIndex === m.correctIndex;
    if (correct) {
      await ctx.db.patch(m._id, { resolved: true });
    }
    return { correct, correctIndex: m.correctIndex, explanation: m.explanation };
  },
});

/** Award XP for finishing a revision session. Idempotent per hour-bucket. */
export const completeRevision = mutation({
  args: { itemsReviewed: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const items = Math.min(Math.max(Math.round(args.itemsReviewed), 1), 100);
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const ref = `revision:${todayISO()}:${hourBucket}`;

    await progressQuests(ctx, userId, "revision_done", 1);
    await progressQuests(ctx, userId, "minutes_studied", Math.min(items * 2, 30));
    const settled = await settleQuests(ctx, userId);

    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.REVISION_DONE,
      `Completed a revision session (${items} items)`,
    );
    return { xp, settledQuests: settled };
  },
});

/** Save incorrect quiz questions for revision (called at quiz submission). */
export const saveMistakes = mutation({
  args: {
    noteId: v.id("notes"),
    topic: v.string(),
    mistakes: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        explanation: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<number> => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) throw new Error("Quiz not found.");
    let saved = 0;
    for (const m of args.mistakes.slice(0, 20)) {
      // Skip if the same question is already unresolved for this user/topic.
      const dup = await ctx.db
        .query("quizMistakes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.eq(q.field("question"), m.question) && q.eq(q.field("resolved"), false),
        )
        .first();
      if (dup) continue;
      await ctx.db.insert("quizMistakes", {
        userId,
        noteId: args.noteId,
        topic: args.topic,
        question: m.question,
        options: m.options,
        correctIndex: m.correctIndex,
        explanation: m.explanation,
        resolved: false,
        createdAt: Date.now(),
      });
      saved++;
    }
    return saved;
  },
});
