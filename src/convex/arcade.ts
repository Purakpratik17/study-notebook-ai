import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";

/** Game catalogue — metadata only, unlock logic lives in getArcade. */
export const GAMES = [
  {
    id: "blocks",
    name: "Study Blocks",
    desc: "Clear lines. Beat your high score.",
    unlockHint: "Complete 4 hours of continuous active study",
    icon: "🧱",
  },
  {
    id: "bee",
    name: "Study Bee",
    desc: "How long can you stay airborne?",
    unlockHint: "Complete 25 quests",
    icon: "🐝",
  },
] as const;

type UnlockMap = { blocks?: boolean; bee?: boolean };

async function getProfileRow(
  ctx: { db: any },
  userId: string,
): Promise<null | { _id: any; arcadeUnlocks?: UnlockMap; tetrisHighScore?: number; beeHighScore?: number }> {
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

async function ensureUnlock(
  ctx: { db: any },
  userId: string,
  gameId: "blocks" | "bee",
): Promise<boolean> {
  const profile = await getProfileRow(ctx, userId);
  if (profile?.arcadeUnlocks?.[gameId]) return false; // already unlocked
  if (profile) {
    await ctx.db.patch(profile._id, {
      arcadeUnlocks: { ...profile.arcadeUnlocks, [gameId]: true },
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("profiles", {
      userId,
      arcadeUnlocks: { [gameId]: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return true; // newly unlocked
}

/** The full arcade state for the current user (reactive). */
export const getArcade = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await getProfileRow(ctx, userId);
    const unlocks = profile?.arcadeUnlocks ?? {};

    // Evaluate unlock conditions live so freshly-earned unlocks appear
    // even before the hook mutations run.
    const questCompletions = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const blocksUnlocked =
      unlocks.blocks === true ||
      (await ctx.db
        .query("xpEvents")
        .withIndex("by_user_ref", (q) =>
          q.eq("userId", userId).eq("ref", "egg:tetris"),
        )
        .first()) !== null;
    const beeUnlocked =
      unlocks.bee === true || questCompletions.length >= 25;

    return {
      games: GAMES.map((g) => ({
        ...g,
        unlocked:
          g.id === "blocks" ? blocksUnlocked : g.id === "bee" ? beeUnlocked : false,
        bestScore:
          g.id === "blocks"
            ? (profile?.tetrisHighScore ?? 0)
            : (profile?.beeHighScore ?? 0),
      })),
      questCount: questCompletions.length,
    };
  },
});

/** Persist a best score for a game. Only ever raises the user's own score. */
export const saveScore = mutation({
  args: { gameId: v.string(), score: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const score = Math.max(0, Math.floor(args.score));
    const profile = await getProfileRow(ctx, userId);
    const field = args.gameId === "blocks" ? "tetrisHighScore" : "beeHighScore";
    const current = profile
      ? (profile as any)[field] ?? 0
      : 0;
    if (score <= current) return false;
    if (profile) {
      await ctx.db.patch(profile._id, {
        [field]: score,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        [field]: score,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return true;
  },
});

/**
 * Hook called after quest completion: unlocks Study Bee at 25 completed
 * quests. Returns true the first time the unlock happens.
 */
export const onQuestCompleted = mutation({
  args: {},
  handler: async (ctx): Promise<{ newlyUnlocked: boolean }> => {
    const userId = await requireUserId(ctx);
    const done = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (done.length < 25) return { newlyUnlocked: false };
    const newlyUnlocked = await ensureUnlock(ctx, userId, "bee");
    return { newlyUnlocked };
  },
});

/**
 * DEV/TEST ONLY helper: immediately grant a permanent unlock so the flow can
 * be verified without a real 4-hour session. Guarded by an environment flag
 * so it throws for production users. Never touches XP or quest/study records.
 */
export const devUnlockGame = mutation({
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    if (process.env.ARCADE_DEV_UNLOCK !== "enabled") {
      throw new Error("Dev unlocks are disabled in this deployment");
    }
    const userId = await requireUserId(ctx);
    if (args.gameId !== "blocks" && args.gameId !== "bee") {
      throw new Error("Unknown game");
    }
    const newlyUnlocked = await ensureUnlock(ctx, userId, args.gameId);
    return { newlyUnlocked };
  },
});

/**
 * DEV/TEST ONLY: clear any dev-granted test unlocks, restoring the real
 * production unlock conditions. Server-gated like devUnlockGame.
 */
export const devResetArcade = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.ARCADE_DEV_UNLOCK !== "enabled") {
      throw new Error("Dev unlocks are disabled in this deployment");
    }
    const userId = await requireUserId(ctx);
    const profile = await getProfileRow(ctx, userId);
    if (profile?.arcadeUnlocks) {
      await ctx.db.patch(profile._id, {
        arcadeUnlocks: {},
        updatedAt: Date.now(),
      });
    }
    return { reset: true };
  },
});
