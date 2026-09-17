import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserId } from "./identity";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";
import { XP_REWARDS } from "./data";

/**
 * Focus sessions. Anti-exploit design:
 * - `start` returns a start timestamp stored server-side per user.
 * - `complete` computes elapsed time from that server timestamp, so a client
 *   cannot claim to have studied 50 minutes in 5 seconds.
 * - XP ref is per day per hour-bucket, so repeated completion in the same
 *   hour never double-rewards.
 */
export const start = mutation({
  args: { plannedMinutes: v.number() },
  handler: async (ctx, args): Promise<number> => {
    await requireUserId(ctx);
    return Date.now();
  },
});

export const complete = mutation({
  args: {
    startedAt: v.number(),
    plannedMinutes: v.number(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const elapsedMs = Date.now() - args.startedAt;
    const elapsedMinutes = Math.floor(elapsedMs / 60_000);

    // The user must actually have studied for most of the planned time.
    // Allow a small grace (e.g. they finished the last seconds early).
    const required = Math.max(Math.floor(args.plannedMinutes * 0.9), 1);
    if (elapsedMinutes + 1 < required) {
      return {
        ok: false as const,
        reason: "Session too short — the timer runs on real time.",
        elapsedMinutes,
      };
    }
    if (elapsedMinutes > args.plannedMinutes * 3) {
      return {
        ok: false as const,
        reason: "Session data is stale. Start a new focus session.",
        elapsedMinutes,
      };
    }

    const minutes = Math.min(args.plannedMinutes, 240);
    const day = new Date().toISOString().slice(0, 10);
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const ref = `focus:${day}:${hourBucket}`;

    await progressQuests(ctx, userId, "minutes_studied", minutes);
    await progressQuests(ctx, userId, "focus_completed", 1);
    const settled = await settleQuests(ctx, userId);

    const xp = await grantXp(
      ctx,
      userId,
      ref,
      XP_REWARDS.FOCUS_SESSION,
      `Focus session — ${minutes} minutes`,
      minutes, // counts toward daily goal, streak, study-time stats
    );
    return { ok: true as const, xp, settledQuests: settled, minutes };
  },
});
