import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { todayISO, XP_REWARDS } from "./data";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";

/** All timetable entries for the signed-in user, newest date first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const entries = await ctx.db
      .query("timetableEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    entries.sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date),
    );
    return entries.map((e) => ({
      _id: e._id,
      subject: e.subject,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      notes: e.notes,
      completed: e.completed,
      createdAt: e.createdAt,
    }));
  },
});

export const create = mutation({
  args: {
    subject: v.string(),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!args.subject.trim()) throw new Error("Subject is required");
    if (args.endTime <= args.startTime) {
      throw new Error("End time must be after start time");
    }
    const id = await ctx.db.insert("timetableEntries", {
      userId,
      subject: args.subject.trim(),
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      notes: args.notes?.trim() || undefined,
      completed: false,
      createdAt: Date.now(),
    });
    return { _id: id };
  },
});

export const remove = mutation({
  args: { entryId: v.id("timetableEntries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== userId) {
      throw new Error("Task not found");
    }
    await ctx.db.delete(args.entryId);
    return { ok: true };
  },
});

/**
 * Toggle completion of a timetable task.
 * XP is awarded once per task via the xpEvents journal — unchecking and
 * rechecking never double-rewards.
 */
export const toggleComplete = mutation({
  args: { entryId: v.id("timetableEntries") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.userId !== userId) {
      throw new Error("Task not found");
    }

    let result = null;
    let settledQuests: Array<{ title: string; xp: number; difficulty: string }> = [];
    if (!entry.completed) {
      await ctx.db.patch(args.entryId, { completed: true });
      result = await grantXp(
        ctx,
        userId,
        `task:${args.entryId}`,
        XP_REWARDS.TIMETABLE_TASK,
        "Completed a timetable task",
      );
      await progressQuests(ctx, userId, "task_completed", 1);
      settledQuests = await settleQuests(ctx, userId);
      const stats = await ctx.db
        .query("stats")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (stats) {
        await ctx.db.patch(stats._id, {
          totalTasksCompleted: stats.totalTasksCompleted + 1,
        });
      }
    } else {
      await ctx.db.patch(args.entryId, { completed: false });
      const stats = await ctx.db
        .query("stats")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (stats && stats.totalTasksCompleted > 0) {
        await ctx.db.patch(stats._id, {
          totalTasksCompleted: stats.totalTasksCompleted - 1,
        });
      }
    }

    return {
      completed: !entry.completed,
      today: todayISO(),
      xp: result,
      settledQuests,
    };
  },
});
