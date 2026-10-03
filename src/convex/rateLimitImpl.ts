import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { enforceRateLimit } from "./rateLimit";

/**
 * Rate-limit recorder — an internalMutation so ACTIONS (which have no ctx.db)
 * can enforce limits through it. Query/mutation callers may use
 * enforceRateLimit directly; actions must route through this.
 */
export const record = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    await enforceRateLimit(ctx, args.key, args.limit, args.windowMs);
  },
});
