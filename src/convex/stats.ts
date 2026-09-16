import { v } from "convex/values";
import { MutationCtx, QueryCtx, query } from "./_generated/server";
import { requireUserId } from "./identity";
import {
  DAILY_GOAL_MINUTES,
  LEVELS,
  levelForXp,
  nextLevel,
  todayISO,
  XP_REWARDS,
} from "./data";
import { Doc } from "./_generated/dataModel";

type StatsDoc = Doc<"stats">;

function emptyStats(userId: string): Omit<StatsDoc, "_id" | "_creationTime"> {
  const now = Date.now();
  return {
    userId,
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    totalTasksCompleted: 0,
    totalQuizzesCompleted: 0,
    totalQuizPoints: 0,
    totalQuizQuestions: 0,
    totalMinutesStudied: 0,
    updatedAt: now,
  };
}

/** Fetch (or lazily create) the stats doc for the current user. */
export async function getOrCreateStats(
  ctx: MutationCtx,
  userId: string,
): Promise<StatsDoc> {
  const existing = await ctx.db
    .query("stats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("stats", emptyStats(userId));
  return (await ctx.db.get(id)) as StatsDoc;
}

export type XpResult = {
  granted: boolean;
  reason: string;
  amount: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  newLevelName: string | null;
};

/**
 * Grant XP exactly once per (userId, ref).
 * `ref` is an idempotency key — e.g. "task:<entryId>" or "quiz:<attemptId>" —
 * so unchecking/rechecking a task or re-running a mutation can never
 * double-reward.
 */
export async function grantXp(
  ctx: MutationCtx,
  userId: string,
  ref: string,
  amount: number,
  reason: string,
  minutesEarned = 0,
): Promise<XpResult> {
  const dup = await ctx.db
    .query("xpEvents")
    .withIndex("by_user_ref", (q) => q.eq("userId", userId).eq("ref", ref))
    .first();
  if (dup) {
    const s = await getOrCreateStats(ctx, userId);
    return {
      granted: false,
      reason,
      amount: 0,
      totalXp: s.xp,
      level: s.level,
      leveledUp: false,
      newLevelName: null,
    };
  }

  const stats = await getOrCreateStats(ctx, userId);
  const beforeLevel = stats.level;
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  let streak = stats.streak;
  if (stats.lastStudyDate === today) {
    // already counted today
  } else if (stats.lastStudyDate === yesterday) {
    streak = streak + 1;
  } else {
    streak = 1;
  }

  const newXp = stats.xp + amount;
  const newLevel = levelForXp(newXp).level;
  const leveledUp = newLevel > beforeLevel;

  // Track studied minutes per calendar day for the daily goal.
  const minutesStudiedToday =
    stats.minutesDay === today ? (stats.minutesStudiedToday ?? 0) : 0;
  const minutesDay = today;

  await ctx.db.patch(stats._id, {
    xp: newXp,
    level: newLevel,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastStudyDate: today,
    minutesDay,
    minutesStudiedToday: minutesStudiedToday + minutesEarned,
    totalMinutesStudied: (stats.totalMinutesStudied ?? 0) + minutesEarned,
    updatedAt: Date.now(),
  });
  await ctx.db.insert("xpEvents", {
    userId,
    amount,
    reason,
    ref,
    createdAt: Date.now(),
  });

  return {
    granted: true,
    reason,
    amount,
    totalXp: newXp,
    level: newLevel,
    leveledUp,
    newLevelName: leveledUp
      ? (LEVELS.find((l) => l.level === newLevel)?.name ?? null)
      : null,
  };
}

/**
 * Weekly/global XP leaderboard computed live from the stats table.
 * Returns display names + level info only — never emails or other private data.
 * Reactive: recomputes on every XP change because it's a Convex query.
 */
export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const meId = await requireUserId(ctx);
    const all = await ctx.db.query("stats").collect();

    const rows = [] as Array<{
      userId: string;
      rank: number;
      name: string;
      username?: string;
      imageUrl?: string;
      xp: number;
      level: number;
      levelName: string;
      isMe: boolean;
    }>;

    for (const s of all) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_id", (q) => q.eq("_id", s.userId as never))
        .unique();
      if (user?.isAnonymous) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", s.userId))
        .first();
      const lvl = levelForXp(s.xp);
      rows.push({
        userId: s.userId,
        rank: 0,
        name: profile?.displayName ?? user?.name ?? "Student",
        username: profile?.username ?? undefined,
        imageUrl: profile?.avatar ?? user?.image ?? undefined,
        xp: s.xp,
        level: lvl.level,
        levelName: lvl.name,
        isMe: s.userId === meId,
      });
    }

    rows.sort((a, b) => b.xp - a.xp);
    const top = rows.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 }));

    // Ensure the current user's row is always present even outside top 50.
    if (!top.some((r) => r.isMe)) {
      const me = rows.find((r) => r.isMe);
      if (me) {
        top.push({ ...me, rank: rows.findIndex((r) => r.isMe) + 1 });
      }
    }
    return top;
  },
});

/** Whether the user's last XP-earning day was today (a "study day"). */
export async function studiedToday(ctx: QueryCtx | MutationCtx, userId: string): Promise<boolean> {
  const stats = await ctx.db
    .query("stats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return stats?.lastStudyDate === todayISO();
}

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!stats) return null;
    const cur = levelForXp(stats.xp);
    const nxt = nextLevel(stats.level);
    const span = nxt ? nxt.xp - cur.xp : 1;
    const into = nxt ? stats.xp - cur.xp : 1;
    return {
      xp: stats.xp,
      level: stats.level,
      levelName: cur.name,
      nextLevel: nxt ? nxt.level : null,
      nextLevelName: nxt ? nxt.name : null,
      xpIntoLevel: nxt ? into : stats.xp,
      xpForNextLevel: nxt ? nxt.xp : stats.xp,
      xpNeeded: nxt ? Math.max(nxt.xp - stats.xp, 0) : 0,
      progress: Math.min(Math.max(into / span, 0), 1),
      maxLevel: !nxt,
      streak: stats.streak,
      bestStreak: stats.bestStreak,
      totalTasksCompleted: stats.totalTasksCompleted,
      totalQuizzesCompleted: stats.totalQuizzesCompleted,
      totalMinutesStudied: stats.totalMinutesStudied ?? 0,
      minutesStudiedToday:
        stats.minutesDay === todayISO() ? (stats.minutesStudiedToday ?? 0) : 0,
      quizAverage:
        stats.totalQuizQuestions > 0
          ? Math.round((stats.totalQuizPoints / stats.totalQuizQuestions) * 100)
          : null,
    };
  },
});

export const getXpRewards = query({
  args: {},
  handler: async () => XP_REWARDS,
});

/** Dashboard summary: today's tasks, streak and daily completion. */
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const today = todayISO();
    const entries = await ctx.db
      .query("timetableEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", today),
      )
      .collect();
    const completed = entries.filter((e) => e.completed).length;
    const plannedMinutes = entries.reduce((sum, e) => {
      const [sh, sm] = e.startTime.split(":").map(Number);
      const [eh, em] = e.endTime.split(":").map(Number);
      const mins = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
      return sum + Math.max(mins, 0);
    }, 0);
    const doneMinutes = entries
      .filter((e) => e.completed)
      .reduce((sum, e) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = e.endTime.split(":").map(Number);
        const mins = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
        return sum + Math.max(mins, 0);
      }, 0);

    const activeQuests = await ctx.db
      .query("quests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = activeQuests.filter((q) => q.status === "active");

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const studiedMinutesToday =
      stats?.minutesDay === today ? (stats.minutesStudiedToday ?? 0) : 0;

    return {
      today,
      tasksTotal: entries.length,
      tasksCompleted: completed,
      plannedMinutes,
      doneMinutes,
      studiedMinutesToday,
      dailyGoalMinutes: DAILY_GOAL_MINUTES,
      completionPercent:
        entries.length === 0
          ? 0
          : Math.round((completed / entries.length) * 100),
      dailyGoalBonusReady:
        Math.max(doneMinutes, studiedMinutesToday) >= DAILY_GOAL_MINUTES,
      activeQuests: active.slice(0, 4).map((q) => ({
        _id: q._id,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        xp: q.xp,
        progress: q.progress,
        target: q.target,
        metric: q.metric,
      })),
      studiedToday: await studiedToday(ctx, userId),
    };
  },
});

export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const events = await ctx.db
      .query("xpEvents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    return events.map((e) => ({
      _id: e._id,
      amount: e.amount,
      reason: e.reason,
      createdAt: e.createdAt,
    }));
  },
});
