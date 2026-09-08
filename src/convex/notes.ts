import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { XP_REWARDS } from "./data";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";

/** Save generated notes for the signed-in user. */
export const saveGenerated = mutation({
  args: {
    topic: v.string(),
    notes: v.any(),
    quiz: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        explanation: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const id = await ctx.db.insert("notes", {
      userId,
      topic: args.topic,
      notes: args.notes,
      quiz: args.quiz,
      createdAt: Date.now(),
    });

    // Quests: generating notes for a new topic.
    await progressQuests(ctx, userId, "notes_generated", 1);
    const settled = await settleQuests(ctx, userId);

    // Award the one-time "generated notes" XP.
    const xp = await grantXp(
      ctx,
      userId,
      `notes:${id}`,
      XP_REWARDS.STUDY_SESSION,
      "Generated AI study notes",
    );

    return { noteId: id, xp, settledQuests: settled };
  },
});

/** Saved topics for the library, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return notes.map((n) => ({
      _id: n._id,
      topic: n.topic,
      quizCount: n.quiz.length,
      createdAt: n.createdAt,
    }));
  },
});

export const get = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) return null;
    return {
      _id: note._id,
      topic: note.topic,
      notes: note.notes,
      quiz: note.quiz,
      createdAt: note.createdAt,
    };
  },
});

/**
 * Record a completed quiz attempt. The XP ref is per note per calendar day
 * (quiz:<noteId>:<YYYY-MM-DD>) so the first finished quiz of a topic each day
 * is rewarded, while retries never double-reward.
 */
export const recordAttempt = mutation({
  args: {
    noteId: v.id("notes"),
    score: v.number(),
    total: v.number(),
    percent: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) throw new Error("Quiz not found");

    await ctx.db.insert("quizAttempts", {
      userId,
      noteId: args.noteId,
      topic: note.topic,
      score: args.score,
      total: args.total,
      createdAt: Date.now(),
    });

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (stats) {
      await ctx.db.patch(stats._id, {
        totalQuizzesCompleted: stats.totalQuizzesCompleted + 1,
        totalQuizPoints: stats.totalQuizPoints + args.score,
        totalQuizQuestions: stats.totalQuizQuestions + args.total,
      });
    }

    // Quests: quiz completed + best score metric.
    await progressQuests(ctx, userId, "quiz_completed", 1);
    await progressQuests(ctx, userId, "quiz_score", args.percent, "set");
    const settled = await settleQuests(ctx, userId);

    const ref = `quiz:${args.noteId}:${new Date().toISOString().slice(0, 10)}`;
    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.QUIZ_COMPLETED,
      `Completed a quiz on ${note.topic}`,
    );

    return { xp, settledQuests: settled, percent: args.percent };
  },
});

/** Manually log a study session (minutes) from the dashboard. */
export const logStudySession = mutation({
  args: { minutes: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const minutes = Math.min(Math.max(Math.round(args.minutes), 1), 240);
    const ref = `session:${new Date()
      .toISOString()
      .slice(0, 10)}:${Math.floor(Date.now() / 3600_000)}`;

    await progressQuests(ctx, userId, "minutes_studied", minutes);
    const settled = await settleQuests(ctx, userId);

    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.STUDY_SESSION,
      `Studied for ${minutes} minutes`,
      minutes,
    );

    return { xp, settledQuests: settled, minutes };
  },
});

/** Bonus XP when today's studied minutes reach the daily goal. */
export const claimDailyGoal = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const ref = `daily-goal:${new Date().toISOString().slice(0, 10)}`;
    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.DAILY_GOAL_BONUS,
      "Daily study goal reached",
    );
    return { xp };
  },
});
