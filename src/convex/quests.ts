import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { requireUserId } from "./identity";
import { XP_REWARDS } from "./data";
import { grantXp } from "./stats";
import { Doc } from "./_generated/dataModel";

export type QuestTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  metric:
    | "quiz_completed"
    | "task_completed"
    | "minutes_studied"
    | "notes_generated"
    | "quiz_score"
    | "flashcards_reviewed"
    | "revision_done"
    | "focus_completed";
  target: number;
};

export const QUEST_CATALOG: QuestTemplate[] = [
  {
    id: "study_30",
    title: "Focus Sprint",
    description: "Study for 30 minutes today",
    difficulty: "easy",
    metric: "minutes_studied",
    target: 30,
  },
  {
    id: "study_60",
    title: "Deep Work",
    description: "Study for 60 minutes today",
    difficulty: "medium",
    metric: "minutes_studied",
    target: 60,
  },
  {
    id: "tasks_2",
    title: "Double Duty",
    description: "Complete 2 timetable tasks",
    difficulty: "easy",
    metric: "task_completed",
    target: 2,
  },
  {
    id: "tasks_3",
    title: "Checklist Champion",
    description: "Complete 3 timetable tasks",
    difficulty: "medium",
    metric: "task_completed",
    target: 3,
  },
  {
    id: "notes_1",
    title: "Curious Mind",
    description: "Generate notes for a new topic",
    difficulty: "easy",
    metric: "notes_generated",
    target: 1,
  },
  {
    id: "quiz_1",
    title: "First Attempt",
    description: "Complete a quiz",
    difficulty: "easy",
    metric: "quiz_completed",
    target: 1,
  },
  {
    id: "flash_10",
    title: "Card Sharp",
    description: "Review 10 flashcards",
    difficulty: "easy",
    metric: "flashcards_reviewed",
    target: 10,
  },
  {
    id: "flash_20",
    title: "Memory Master",
    description: "Review 20 flashcards",
    difficulty: "medium",
    metric: "flashcards_reviewed",
    target: 20,
  },
  {
    id: "revision_1",
    title: "Patch the Gaps",
    description: "Complete a revision session",
    difficulty: "easy",
    metric: "revision_done",
    target: 1,
  },
  {
    id: "focus_1",
    title: "Locked In",
    description: "Complete a focus session",
    difficulty: "medium",
    metric: "focus_completed",
    target: 1,
  },
  {
    id: "quiz_80",
    title: "High Scorer",
    description: "Score at least 80% on a quiz",
    difficulty: "medium",
    metric: "quiz_score",
    target: 80,
  },
  {
    id: "quiz_100",
    title: "Flawless Victory",
    description: "Score 100% on a quiz",
    difficulty: "hard",
    metric: "quiz_score",
    target: 100,
  },
  {
    id: "schedule_clear",
    title: "Schedule Clearer",
    description: "Complete every task on today's schedule",
    difficulty: "hard",
    metric: "task_completed",
    target: 3,
  },
];

const QUEST_XP: Record<QuestTemplate["difficulty"], number> = {
  easy: XP_REWARDS.QUEST_EASY,
  medium: XP_REWARDS.QUEST_MEDIUM,
  hard: XP_REWARDS.QUEST_HARD,
};

/** Seeded RNG so the "random" rotation is stable per user+day. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRotation(userId: string): QuestTemplate[] {
  const day = Math.floor(Date.now() / 86400_000);
  const rng = mulberry32(
    [...userId].reduce((a, c) => a + c.charCodeAt(0), 0) + day * 7919,
  );
  const byDifficulty: Record<QuestTemplate["difficulty"], QuestTemplate[]> = {
    easy: QUEST_CATALOG.filter((q) => q.difficulty === "easy"),
    medium: QUEST_CATALOG.filter((q) => q.difficulty === "medium"),
    hard: QUEST_CATALOG.filter((q) => q.difficulty === "hard"),
  };
  const picked: QuestTemplate[] = [];
  const difficulties: QuestTemplate["difficulty"][] = [
    "easy",
    "easy",
    "medium",
    "medium",
    "hard",
  ];
  for (const d of difficulties) {
    const pool = byDifficulty[d].filter((q) => !picked.includes(q));
    if (pool.length > 0) {
      picked.push(pool[Math.floor(rng() * pool.length)]);
    }
  }
  return picked;
}

type QuestDbCtx = MutationCtx | QueryCtx;

async function loadQuestRows(ctx: QuestDbCtx, userId: string) {
  return await ctx.db
    .query("quests")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/** Refresh the daily rotation: clears finished quests, reseeds when empty. */
export async function ensureRotation(ctx: MutationCtx, userId: string) {
  await requireUserId(ctx);
  const rows = await loadQuestRows(ctx, userId);
  for (const q of rows) {
    if (q.status !== "active") {
      await ctx.db.delete(q._id);
    }
  }
  let active = rows.filter((q) => q.status === "active");
  if (active.length === 0) {
    const rotation = pickRotation(userId);
    for (const t of rotation) {
      await ctx.db.insert("quests", {
        userId,
        questId: t.id,
        title: t.title,
        description: t.description,
        difficulty: t.difficulty,
        xp: QUEST_XP[t.difficulty],
        target: t.target,
        metric: t.metric,
        progress: 0,
        status: "active",
        createdAt: Date.now(),
      });
    }
    active = (await loadQuestRows(ctx, userId)).filter(
      (q) => q.status === "active",
    );
  }
  return active;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await loadQuestRows(ctx, userId);
    const order = { easy: 0, medium: 1, hard: 2 } as const;
    return rows
      .filter((q) => q.status === "active")
      .sort((a, b) => order[a.difficulty] - order[b.difficulty])
      .map((q) => ({
        _id: q._id,
        questId: q.questId,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        xp: q.xp,
        target: q.target,
        metric: q.metric,
        progress: q.progress,
        status: q.status,
      }));
  },
});

/** Count of lifetime completed quests (for the profile page). */
export const completedCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const completions = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return { total: completions.length };
  },
});

/** Internal: advance every active quest matching a metric. */
export async function progressQuests(
  ctx: MutationCtx,
  userId: string,
  metric: QuestTemplate["metric"],
  amount: number,
  mode: "increment" | "set" = "increment",
) {
  const quests = await loadQuestRows(ctx, userId);
  for (const q of quests) {
    if (q.status !== "active" || q.metric !== metric) continue;
    const next =
      mode === "set"
        ? Math.max(q.progress, amount)
        : Math.min(q.progress + amount, q.target);
    if (next !== q.progress) {
      await ctx.db.patch(q._id, { progress: next });
    }
  }
}

/** Internal: complete quests that reached their target; award XP once each. */
export async function settleQuests(
  ctx: MutationCtx,
  userId: string,
): Promise<Array<{ title: string; xp: number; difficulty: string }>> {
  const quests = await loadQuestRows(ctx, userId);
  const finished: Array<{ title: string; xp: number; difficulty: string }> = [];
  for (const q of quests) {
    if (q.status !== "active" || q.progress < q.target) continue;
    await ctx.db.patch(q._id, { status: "completed", completedAt: Date.now() });
    await grantXp(
      ctx,
      userId,
      `quest:${q._id}`,
      q.xp,
      `Quest completed: ${q.title}`,
    );
    await ctx.db.insert("questCompletions", {
      userId,
      questKey: `${q._id}:${q.questId}`,
      questId: q.questId,
      title: q.title,
      difficulty: q.difficulty,
      xp: q.xp,
      completedAt: Date.now(),
    });
    finished.push({ title: q.title, xp: q.xp, difficulty: q.difficulty });
  }
  // Arcade hook: Study Bee unlocks permanently at 25 completed quests.
  if (finished.length > 0) {
    const done = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (done.length >= 25) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile && !profile.arcadeUnlocks?.bee) {
        await ctx.db.patch(profile._id, {
          arcadeUnlocks: { ...profile.arcadeUnlocks, bee: true },
          updatedAt: Date.now(),
        });
      } else if (!profile) {
        await ctx.db.insert("profiles", {
          userId,
          arcadeUnlocks: { bee: true },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }
  return finished;
}

/** Refresh the daily quest rotation (call when the Quests page loads). */
export const refresh = mutation({
  args: {},
  handler: async (ctx): Promise<{ active: number; settled: Array<{ title: string; xp: number; difficulty: string }> }> => {
    const userId = await requireUserId(ctx);
    const active = await ensureRotation(ctx, userId);
    const settled = await settleQuests(ctx, userId);
    return { active: active.length, settled };
  },
});
