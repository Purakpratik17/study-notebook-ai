/* ═══════════════════════════════════════════════════════════════════════
   SERVER-SIDE RATE LIMITING — sliding-window counters on a Convex table.

   Enforced inside sensitive mutations so abuse is blocked even from
   scripted clients. Limits are deliberately generous — legitimate users
   never hit them; bursts and spam loops do.

   Config lives in `src/lib/admin-config.ts`-style dependency-free module
   (this file) so both convex and client code can mirror the constants.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Loosely-typed database surface — avoids fighting Convex's generic types
 * while keeping the runtime behavior typed at call sites.
 */
type RateCtx = {
  db: {
    query: (t: "rateLimits") => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withIndex: (name: "by_key", fn?: any) => {
        collect: () => Promise<Array<{ _id: unknown; at: number }>>;
      };
    };
    insert: (
      t: "rateLimits",
      row: { key: string; at: number },
    ) => Promise<unknown>;
    delete: (id: never) => Promise<void>;
  };
};

export async function enforceRateLimit(
  ctx: { db: RateCtx["db"] },
  key: string,
  limit: number,
  windowMs: number,
  friendlyMessage?: string,
): Promise<void> {
  const now = Date.now();
  const cutoff = now - windowMs;
  const rows = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q: { eq: (f: "key", v: string) => unknown }) =>
      q.eq("key", key),
    )
    .collect();
  const recent = rows.filter((r) => r.at >= cutoff);
  if (recent.length >= limit) {
    const retryIn = Math.ceil((recent[0].at + windowMs - now) / 1000);
    throw new Error(
      friendlyMessage ??
        `You're doing that a bit too fast — please wait ${Math.max(retryIn, 1)}s and try again.`,
    );
  }
  // Opportunistic cleanup of this key's expired rows (cheap, amortized).
  for (const r of rows) {
    if (r.at < cutoff) await ctx.db.delete(r._id as never);
  }
  await ctx.db.insert("rateLimits", { key, at: now });
}

/** Common limits used by callers. */
export const RATE_LIMITS = {
  ai: { limit: 5, windowMs: 10 * 60_000 }, // 5 AI generations / 10 min
  aiChat: { limit: 30, windowMs: 10 * 60_000 }, // 30 tutor chat AI calls / 10 min
  chat: { limit: 60, windowMs: 60_000 }, // 60 chat msgs / minute
  friendRequest: { limit: 15, windowMs: 10 * 60_000 }, // 15 requests / 10 min
  upload: { limit: 40, windowMs: 5 * 60_000 }, // 40 media uploads / 5 min
  deletion: { limit: 3, windowMs: 60 * 60_000 }, // 3 delete attempts / hour
} as const;

export const AI_RATE_MESSAGE =
  "You're generating a lot of content right now. Please wait a little before generating again.";