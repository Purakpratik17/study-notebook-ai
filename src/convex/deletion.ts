import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserId } from "./identity";
import { enforceRateLimit, RATE_LIMITS } from "./rateLimit";

/* ═══════════════════════════════════════════════════════════════════════
   ACCOUNT DELETION — permanent, self-service, server-side only.

   Safety model:
   • requireUserId(ctx) gates the whole mutation on a verified Clerk JWT.
   • Only rows belonging to the caller (matched by their Clerk subject)
     are touched. Shared data other users participate in is preserved:
     - Group chats the user joined but doesn't own: they are removed from
       the member list; the group survives for remaining members.
     - Groups the user owns: deleted (they were the owner).
     - Other participants' messages in shared conversations are preserved
       by design: 1:1 conversations die with the friendship, but in group
       chats only the departing user's own messages are removed.
   • Every schema table with a userId/fromId/toId/senderId/ownerId field
     is covered.
   • Idempotent: running twice succeeds (second run finds nothing).
   ═══════════════════════════════════════════════════════════════════════ */

// Tables keyed simply by userId === caller (all have a by_user index).
const USER_OWNED_TABLES = [
  "stats",
  "profiles",
  "achievements",
  "essays",
  "projects",
  "xpEvents",
  "timetableEntries",
  "quests",
  "questCompletions",
  "notes",
  "practiceSessions",
  "quizAttempts",
  "tutorSessions",
  "savedQuestions",
  "importantQuestions",
  "studyPositions",
  "flashcards",
  "flashcardReviews",
  "quizMistakes",
  "chatPurchases",
  "chatSettings",
  "folders",
  "myNotes",
  "whiteboards",
  "shares",
] as const;

/** Minimal generic shape so one typed loop can query any by_user table. */
type DbByUserIndex = {
  collect: () => Promise<Array<{ _id: never }>>;
};
type DbByUserQuery = {
  withIndex: (
    name: "by_user",      fn: (q2: { eq: (f: "userId", v: string) => never }) => DbByUserIndex,
  ) => DbByUserIndex;
};
type DbByUser = {
  query: (t: string) => DbByUserQuery;
};

export const deleteMyAccount = mutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUserId(ctx);
    // Guard against scripted/accidental repeated deletion attempts.
    await enforceRateLimit(
      ctx,
      `deletion:${me}`,
      RATE_LIMITS.deletion.limit,
      RATE_LIMITS.deletion.windowMs,
    );
    if (args.confirm !== "DELETE") {
      throw new Error(
        "Confirmation text did not match. Type DELETE to confirm.",
      );
    }

    let deleted = 0;

    // 1) Simple user-owned tables (by_user index on every one of these).
    //    Cast is safe: every table listed here has a by_user(userId) index.
    for (const table of USER_OWNED_TABLES) {
      // Every table listed has a by_user(userId) index; cast to the generic
      // shape below so one loop covers all of them.
      const rows = await (ctx.db as unknown as DbByUser)
        .query(table)
        .withIndex("by_user", (q2) => q2.eq("userId", me))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id as never);
        deleted++;
      }
    }

    // 2) Friend requests (either side).
    const fromReqs = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_status", (q) => q.eq("fromId", me))
      .collect();
    const toReqs = await ctx.db
      .query("friendRequests")
      .withIndex("by_to_status", (q) => q.eq("toId", me))
      .collect();
    for (const row of [...fromReqs, ...toReqs]) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    // 3) Friendships involving me.
    const byA = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", me))
      .collect();
    const byB = await ctx.db
      .query("friendships")
      .withIndex("by_userB", (q) => q.eq("userB", me))
      .collect();
    for (const f of [...byA, ...byB]) {
      await ctx.db.delete(f._id);
      deleted++;
    }

    // 4) My 1:1 conversations (+ messages + their media).
    const convByA = await ctx.db
      .query("conversations")
      .withIndex("by_userA", (q) => q.eq("userA", me))
      .collect();
    const convByB = await ctx.db
      .query("conversations")
      .withIndex("by_userB", (q) => q.eq("userB", me))
      .collect();
    for (const conv of [...convByA, ...convByB]) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      for (const m of msgs) {
        if (m.storageId) await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
        deleted++;
      }
      await ctx.db.delete(conv._id);
      deleted++;
    }

    // 5) Groups I own → delete with messages/media. Groups I joined → leave
    //    (group survives for remaining members).
    const ownedGroups = await ctx.db
      .query("groups")
      .withIndex("by_owner", (q) => q.eq("ownerId", me))
      .collect();
    for (const g of ownedGroups) {
      const msgs = await ctx.db
        .query("groupMessages")
        .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
        .collect();
      for (const m of msgs) {
        if (m.storageId) await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
        deleted++;
      }
      await ctx.db.delete(g._id);
      deleted++;
    }
    const allGroups = await ctx.db.query("groups").collect();
    for (const g of allGroups) {
      if (g.ownerId !== me && g.members.includes(me)) {
        await ctx.db.patch(g._id, {
          members: g.members.filter((id) => id !== me),
          mutedBy: g.mutedBy?.filter((id) => id !== me),
        });
      }
    }

    // 6) My messages inside groups I merely joined (others' messages stay).
    for (const g of allGroups) {
      if (g.ownerId === me || !g.members.includes(me)) continue;
      const msgs = await ctx.db
        .query("groupMessages")
        .withIndex("by_group_created", (q) => q.eq("groupId", g._id))
        .collect();
      for (const m of msgs) {
        if (m.senderId !== me) continue;
        if (m.storageId) await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
        deleted++;
      }
    }

    // 7) Convex auth user record (removes the backend account row).
    const authUsers = await ctx.db.query("users").collect();
    for (const u of authUsers) {
      const rec = u as unknown as { tokenIdentifier?: string };
      if (rec.tokenIdentifier?.includes(me)) {
        await ctx.db.delete(u._id);
        deleted++;
      }
    }

    console.log(`[deletion] ok rows=${deleted}`);
    return { deleted };
  },
});
