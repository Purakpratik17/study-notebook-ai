import { query } from "./_generated/server";
import { DAILY_GOAL_MINUTES, LEVELS, XP_REWARDS } from "./data";

/**
 * Live configuration for the client: XP reward table, level ladder, and
 * daily goal. Rewards are never hard-coded in the UI — screens read them
 * from here so the economy can be retuned in one place (src/convex/data.ts).
 */
export const get = query({
  args: {},
  handler: async () => {
    return {
      xpRewards: XP_REWARDS,
      levels: LEVELS.map((l) => ({
        level: l.level,
        xp: l.xp,
        name: l.name,
      })),
      dailyGoalMinutes: DAILY_GOAL_MINUTES,
    };
  },
});
