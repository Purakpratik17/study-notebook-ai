import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireUserId } from "./identity";
import { XP_REWARDS } from "./data";
import { grantXp } from "./stats";
import { progressQuests, settleQuests } from "./quests";
import { chatCompletion, extractJson } from "./ai";

const MAX_QUESTIONS = 30;

/** Difficulty → token budget so hard topics still fit complete questions. */
const TOKENS: Record<"easy" | "medium" | "hard", number> = {
  easy: 2600,
  medium: 3400,
  hard: 4200,
};

function buildPrompt(
  subject: string,
  topic: string,
  difficulty: "easy" | "medium" | "hard",
  count: number,
) {
  const levelNote = {
    easy: "accessible recall and basic understanding questions",
    medium: "application and multi-step reasoning questions",
    hard: "challenging analysis, synthesis and tricky-distractor questions",
  }[difficulty];

  return `You are an expert ${subject} tutor. Create a practice drill of exactly ${count} multiple-choice questions on "${topic}" (subject: ${subject}, difficulty: ${difficulty} — ${levelNote}).

Return ONLY valid JSON (no markdown fences, no commentary) matching this TypeScript type:

{
  "questions": [
    {
      "question": string,
      "options": [string, string, string, string],
      "correctIndex": 0,
      "explanation": string
    }
  ]
}

Field rules:
- Exactly ${count} questions. Each has exactly 4 options, exactly one correct (correctIndex 0-3).
- Questions must be self-contained (no "from the passage above"), factually accurate, and curriculum-appropriate for ${subject}.
- "explanation": 1-2 sentences explaining why the correct answer is right.
- Vary which option is correct across questions.
- No numbering in the "question" text.`;
}

/** ─── Generate + persist a practice session ─────────────────────────────── */
export const start = action({
  args: {
    subject: v.string(),
    topic: v.string(),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard"),
    ),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const topic = args.topic.trim().slice(0, 120);
    const subject = args.subject.trim().slice(0, 60) || "General";
    const count = Math.min(Math.max(Math.round(args.count), 1), MAX_QUESTIONS);
    if (topic.length < 2) throw new Error("Please choose a topic to practice");

    const content = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Cerevyn, an expert academic tutor. Respond with a single valid JSON object only — no markdown fences, no commentary.",
        },
        {
          role: "user",
          content: buildPrompt(subject, topic, args.difficulty, count),
        },
      ],
      0.5,
      TOKENS[args.difficulty],
    );

    const parsed = extractJson(content) as { questions?: unknown };

    const questions = Array.isArray(parsed.questions)
      ? (parsed.questions as Array<Record<string, unknown>>)
          .filter(
            (q) =>
              !!q &&
              typeof q.question === "string" &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              typeof q.correctIndex === "number" &&
              q.correctIndex >= 0 &&
              q.correctIndex < 4 &&
              q.options.every((o) => typeof o === "string"),
          )
          .map((q) => ({
            question: q.question as string,
            options: (q.options as string[]).map(String),
            correctIndex: q.correctIndex as number,
            explanation: String(q.explanation ?? ""),
          }))
      : [];

    if (questions.length === 0) {
      throw new Error("AI response was incomplete. Please try again.");
    }

    const sessionId: string = await ctx.runMutation(api.practice.insertSession, {
      subject,
      topic,
      difficulty: args.difficulty,
      questions: questions.slice(0, count),
    });
    return { sessionId };
  },
});

/** ─── Fetch a session (own only) ────────────────────────────────────────── */
export const get = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.userId !== userId) return null;
    return s;
  },
});

/** ─── Past practice history (own only, newest first) ────────────────────── */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(15);
    return rows.map((s) => ({
      _id: s._id,
      subject: s.subject,
      topic: s.topic,
      difficulty: s.difficulty,
      score: s.score ?? null,
      total: s.total,
      status: s.status,
      createdAt: s.createdAt,
    }));
  },
});

/** ─── Insert the generated session (called from the action) ─────────────── */
export const insertSession = mutation({
  args: {
    subject: v.string(),
    topic: v.string(),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard"),
    ),
    questions: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        explanation: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("practiceSessions", {
      userId,
      subject: args.subject,
      topic: args.topic,
      difficulty: args.difficulty,
      questions: args.questions,
      answers: [],
      total: args.questions.length,
      status: "in_progress",
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Finish a session: persist answers, award XP once (idempotent ref per
 * session id — retries can never double-reward), progress quests.
 */
export const complete = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    answers: v.array(v.number()), // index-aligned; -1 = unanswered/skipped
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    score: number;
    total: number;
    percent: number;
    xp: {
      granted: boolean;
      amount: number;
      totalXp: number;
      level: number;
      leveledUp: boolean;
      newLevelName: string | null;
    };
    settledQuests: Array<{ title: string; xp: number; difficulty: string }>;
  }> => {
    const userId = await requireUserId(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.userId !== userId) throw new Error("Practice session not found");

    const answers = args.answers.map((a) =>
      typeof a === "number" && a >= -1 && a < 4 ? a : -1,
    );
    const score = s.questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
      0,
    );
    const total = s.total;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    const alreadyCompleted = s.status === "completed";
    await ctx.db.patch(s._id, {
      answers,
      score,
      status: "completed",
      completedAt: s.completedAt ?? Date.now(),
    });

    // Stats: count every finished session into quiz totals.
    const stats = await ctx.db
      .query("stats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (stats && !alreadyCompleted) {
      await ctx.db.patch(stats._id, {
        totalQuizzesCompleted: stats.totalQuizzesCompleted + 1,
        totalQuizPoints: stats.totalQuizPoints + score,
        totalQuizQuestions: stats.totalQuizQuestions + total,
        updatedAt: Date.now(),
      });
    }

    let settled: Array<{ title: string; xp: number; difficulty: string }> = [];
    if (!alreadyCompleted) {
      // Quests: practice counts as a completed quiz + best score metric.
      await progressQuests(ctx, userId, "quiz_completed", 1);
      await progressQuests(ctx, userId, "quiz_score", percent, "set");
      settled = await settleQuests(ctx, userId);
    }

    // Idempotent XP: ref is the session id, so repeat completes never double-reward.
    const xp = await grantXp(
      ctx,
      userId,
      `practice:${s._id}`,
      XP_REWARDS.QUIZ_COMPLETED,
      `Practice drill on ${s.topic}`,
    );

    return { score, total, percent, xp, settledQuests: settled };
  },
});
