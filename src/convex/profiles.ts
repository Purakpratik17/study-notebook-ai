import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserId } from "./identity";
import { grantXp, getOrCreateStats } from "./stats";

const MAX_BIO = 280;
const MAX_AVATAR_BYTES = 260_000; // ~200KB image as data URL

// ─── Profile ────────────────────────────────────────────────────────────────

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      profile: profile ?? null,
      stats: stats ?? null,
      unlocked: achievements.map((a) => a.achievementId),
    };
  },
});

/** Public, private-data-free view of any user (used by leaderboard/profile cards). */
export const getPublicProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) return null;
    return {
      displayName: profile.displayName,
      username: profile.username,
      bio: profile.bio,
      avatar: profile.avatar,
      school: profile.school,
      course: profile.course,
      interests: profile.interests,
    };
  },
});

function clean(value: string | undefined, max: number): string | undefined {
  const t = value?.trim();
  return t ? t.slice(0, max) : undefined;
}

export const saveProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    school: v.optional(v.string()),
    course: v.optional(v.string()),
    interests: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.username) {
      const uname = args.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (uname.length < 3 || uname.length > 20) {
        throw new Error("Username must be 3–20 letters, numbers or underscores");
      }
      const taken = await ctx.db
        .query("profiles")
        .filter((q) => q.eq(q.field("username"), uname))
        .first();
      if (taken && taken.userId !== userId) {
        throw new Error("That username is already taken");
      }
      args.username = uname;
    }
    if (args.bio !== undefined) args.bio = clean(args.bio, MAX_BIO);
    if (args.avatar && args.avatar.length > MAX_AVATAR_BYTES) {
      throw new Error("Image too large — please choose one under 200KB");
    }
    if (args.avatar && !/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(args.avatar)) {
      throw new Error("Unsupported image format");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    const fields = {
      displayName: clean(args.displayName, 60),
      username: args.username,
      bio: args.bio,
      avatar: args.avatar,
      school: clean(args.school, 80),
      course: clean(args.course, 80),
      interests: clean(args.interests, 120),
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("profiles", { userId, ...fields, createdAt: now });
    }

    // Keep leaderboard display name in sync with profile display name.
    if (fields.displayName) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_id", (q) => q.eq("_id", userId as never))
        .unique();
      if (user) await ctx.db.patch(user._id, { name: fields.displayName });
    }
    return true;
  },
});

// ─── Achievements ───────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  { id: "first_session", name: "First Steps", desc: "Complete your first study session" },
  { id: "first_quiz", name: "Quiz Rookie", desc: "Complete your first quiz" },
  { id: "first_quest", name: "Quest Beginner", desc: "Complete your first quest" },
  { id: "hours_1", name: "One Hour In", desc: "Study for 1 total hour" },
  { id: "hours_10", name: "Focused Ten", desc: "Study for 10 total hours" },
  { id: "hours_25", name: "Marathoner", desc: "Study for 25 total hours" },
  { id: "hours_50", name: "Half Century", desc: "Study for 50 total hours" },
  { id: "hours_100", name: "Centurion", desc: "Study for 100 total hours" },
  { id: "xp_500", name: "Rising Star", desc: "Earn 500 XP" },
  { id: "xp_1500", name: "XP Collector", desc: "Earn 1,500 XP" },
  { id: "xp_3500", name: "Expert Mind", desc: "Earn 3,500 XP" },
  { id: "xp_7000", name: "Mastermind", desc: "Earn 7,000 XP" },
  { id: "xp_14000", name: "Virtuoso", desc: "Earn 14,000 XP" },
  { id: "xp_20000", name: "Learnova Legend", desc: "Earn 20,000 XP" },
  { id: "streak_7", name: "Week Warrior", desc: "Reach a 7-day streak" },
  { id: "streak_30", name: "Month Master", desc: "Reach a 30-day streak" },
  { id: "tetris_unlocked", name: "Arcade Night Owl", desc: "Unlock the 4-hour focus game" },
  { id: "arcade_rookie", name: "Arcade Rookie", desc: "Unlock your first arcade game" },
  { id: "arcade_explorer", name: "Arcade Explorer", desc: "Unlock every arcade game" },
  { id: "block_master", name: "Block Master", desc: "Score 1,000 in Study Blocks" },
  { id: "bee_keeper", name: "Bee Keeper", desc: "Score 15 in Study Bee" },
] as const;

/** Internal: called from grantXp flows via ctx.runMutation. */
export const checkAchievements = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const stats = await getOrCreateStats(ctx, args.userId);
    const have = new Set(
      (
        await ctx.db
          .query("achievements")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      ).map((a) => a.achievementId),
    );
    const questsDone = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const hours = (stats.totalMinutesStudied ?? 0) / 60;
    const profileRow = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const arcadeUnlocksCount =
      (profileRow?.arcadeUnlocks?.blocks ? 1 : 0) +
      (profileRow?.arcadeUnlocks?.bee ? 1 : 0);
    const newlyUnlocked: string[] = [];

    const want: Array<[string, boolean]> = [
      ["first_session", stats.totalTasksCompleted > 0 || (stats.totalMinutesStudied ?? 0) > 0],
      ["first_quiz", stats.totalQuizzesCompleted > 0],
      ["first_quest", questsDone.length > 0],
      ["hours_1", hours >= 1],
      ["hours_10", hours >= 10],
      ["hours_25", hours >= 25],
      ["hours_50", hours >= 50],
      ["hours_100", hours >= 100],
      ["xp_500", stats.xp >= 500],
      ["xp_1500", stats.xp >= 1500],
      ["xp_3500", stats.xp >= 3500],
      ["xp_7000", stats.xp >= 7000],
      ["xp_14000", stats.xp >= 14000],
      ["xp_20000", stats.xp >= 20000],
      ["streak_7", stats.bestStreak >= 7],
      ["streak_30", stats.bestStreak >= 30],
      ["tetris_unlocked", (stats.totalMinutesStudied ?? 0) >= 240],
      ["arcade_rookie", arcadeUnlocksCount >= 1],
      ["arcade_explorer", arcadeUnlocksCount >= 2],
      ["block_master", (profileRow?.tetrisHighScore ?? 0) >= 1000],
      ["bee_keeper", (profileRow?.beeHighScore ?? 0) >= 15],
    ];

    for (const [id, earned] of want) {
      if (earned && !have.has(id)) {
        await ctx.db.insert("achievements", {
          userId: args.userId,
          achievementId: id,
          unlockedAt: Date.now(),
        });
        newlyUnlocked.push(id);
      }
    }
    return newlyUnlocked;
  },
});

/** Check and return any newly unlocked achievements for the current user. */
export const refreshAchievements = mutation({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await requireUserId(ctx);
    return await ctx.runMutation(
      internal.profiles.checkAchievements,
      { userId },
    );
  },
});

export const listAchievements = query({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      id: string;
      name: string;
      desc: string;
      unlocked: boolean;
      unlockedAt: number | null;
      progress: number;
    }>
  > => {
    const userId = await requireUserId(ctx);
    // Query-safe read: fall back to zeroed stats instead of creating a row.
    const statsDoc = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const stats = statsDoc ?? {
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
      updatedAt: 0,
      _id: null as never,
      _creationTime: 0,
    };
    const unlocked = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const myProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const arcadeUnlocksCount =
      (myProfile?.arcadeUnlocks?.blocks ? 1 : 0) +
      (myProfile?.arcadeUnlocks?.bee ? 1 : 0);
    const unlockedMap = new Map(unlocked.map((a) => [a.achievementId, a.unlockedAt]));
    const hours = (stats.totalMinutesStudied ?? 0) / 60;
    const questsDone = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return ACHIEVEMENTS.map((a) => {
      let progress = 0;
      switch (a.id) {
        case "first_session": progress = stats.totalTasksCompleted > 0 || (stats.totalMinutesStudied ?? 0) > 0 ? 1 : 0; break;
        case "first_quiz": progress = stats.totalQuizzesCompleted > 0 ? 1 : 0; break;
        case "first_quest": progress = questsDone.length > 0 ? 1 : 0; break;
        case "hours_1": progress = Math.min(hours / 1, 1); break;
        case "hours_10": progress = Math.min(hours / 10, 1); break;
        case "hours_25": progress = Math.min(hours / 25, 1); break;
        case "hours_50": progress = Math.min(hours / 50, 1); break;
        case "hours_100": progress = Math.min(hours / 100, 1); break;
        case "xp_500": progress = Math.min(stats.xp / 500, 1); break;
        case "xp_1500": progress = Math.min(stats.xp / 1500, 1); break;
        case "xp_3500": progress = Math.min(stats.xp / 3500, 1); break;
        case "xp_7000": progress = Math.min(stats.xp / 7000, 1); break;
        case "xp_14000": progress = Math.min(stats.xp / 14000, 1); break;
        case "xp_20000": progress = Math.min(stats.xp / 20000, 1); break;
        case "streak_7": progress = Math.min(stats.bestStreak / 7, 1); break;
        case "streak_30": progress = Math.min(stats.bestStreak / 30, 1); break;
        case "tetris_unlocked": progress = (stats.totalMinutesStudied ?? 0) >= 240 ? 1 : Math.min((stats.totalMinutesStudied ?? 0) / 240, 1); break;
        case "arcade_rookie": progress = Math.min(arcadeUnlocksCount / 1, 1); break;
        case "arcade_explorer": progress = Math.min(arcadeUnlocksCount / 2, 1); break;
        case "block_master": progress = Math.min((myProfile?.tetrisHighScore ?? 0) / 1000, 1); break;
        case "bee_keeper": progress = Math.min((myProfile?.beeHighScore ?? 0) / 15, 1); break;
      }
      return {
        ...a,
        unlocked: unlockedMap.has(a.id),
        unlockedAt: unlockedMap.get(a.id) ?? null,
        progress,
      };
    });
  },
});

// ─── 4-hour focus session (Easter egg) ─────────────────────────────────────

/**
 * Record a completed focused study session of `minutes`.
 * Must be backed by real tracked time from the client focus timer.
 * Unlocks the arcade Easter egg at 240 minutes in ONE session,
 * and feeds achievements + lifetime minutes. Small XP bonus (+15),
 * journaled per session id so it can never double-award.
 */
export const recordFocusSession = mutation({
  args: {
    sessionId: v.string(), // client-generated uuid for idempotency
    minutes: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    xp: ReturnType<typeof grantXp> extends Promise<infer T> ? T : never;
    minutesTotal: number;
    eggUnlocked: boolean;
    hasEgg: boolean;
    crossedEgg: boolean;
    newlyUnlocked: string[];
  }> => {
    const userId = await requireUserId(ctx);
    const minutes = Math.floor(args.minutes);
    if (minutes <= 0 || minutes > 600) {
      throw new Error("Invalid session length");
    }

    const stats = await getOrCreateStats(ctx, userId);
    const prevTotal = stats.totalMinutesStudied ?? 0;

    // Easter egg: crossing 240 minutes within a single continuous session.
    const crossedEgg =
      prevTotal < 240 && prevTotal + minutes >= 240 && minutes >= 240
        ? false // single-session rule enforced below
        : prevTotal < 240 && prevTotal + minutes >= 240 && minutes >= 30;

    const xp = await grantXp(
      ctx,
      userId,
      `focus:${args.sessionId}`,
      Math.min(30, Math.floor(minutes / 10) * 5), // ≤30 XP, consistent with study rewards
      "Focused study session",
      minutes,
    );

    let eggUnlocked = false;
    // The unlock requires one single session of ≥240 minutes.
    if (minutes >= 240) {
      const already = await ctx.db
        .query("xpEvents")
        .withIndex("by_user_ref", (q) =>
          q.eq("userId", userId).eq("ref", "egg:tetris"),
        )
        .first();
      if (!already) {
        await ctx.db.insert("xpEvents", {
          userId,
          amount: 0,
          reason: "Arcade unlocked",
          ref: "egg:tetris",
          createdAt: Date.now(),
        });
        eggUnlocked = true;
      }
    }
    const hasEgg = eggUnlocked ||
      (await ctx.db
        .query("xpEvents")
        .withIndex("by_user_ref", (q) =>
          q.eq("userId", userId).eq("ref", "egg:tetris"),
        )
        .first()) !== null;

    const newlyUnlocked = await ctx.runMutation(
      internal.profiles.checkAchievements,
      { userId },
    );

    return {
      xp,
      minutesTotal: prevTotal + minutes,
      eggUnlocked,
      hasEgg,
      crossedEgg,
      newlyUnlocked,
    };
  },
});

export const hasArcade = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const marker = await ctx.db
      .query("xpEvents")
      .withIndex("by_user_ref", (q) =>
        q.eq("userId", userId).eq("ref", "egg:tetris"),
      )
      .first();
    return marker !== null;
  },
});

// ─── Tetris high score ──────────────────────────────────────────────────────

export const getTetrisHighScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return profile?.tetrisHighScore ?? 0;
  },
});

export const getBeeHighScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return profile?.beeHighScore ?? 0;
  },
});

export const setTetrisHighScore = mutation({
  args: { score: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const score = Math.max(0, Math.floor(args.score));
    if (profile && score > (profile.tetrisHighScore ?? 0)) {
      await ctx.db.patch(profile._id, { tetrisHighScore: score });
    }
    return true;
  },
});
