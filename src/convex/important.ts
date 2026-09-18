import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireUserId } from "./identity";
import { chatCompletion, extractJson } from "./ai";

/** ─── Important Questions: AI generates exam-style questions for a topic ─── */
export const generate = action({
  args: { subject: v.string(), topic: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    id: string;
    questions: Array<{ question: string; answer: string; difficulty: string }>;
  }> => {
    await requireUserId(ctx);
    const subject = args.subject.trim().slice(0, 60) || "General";
    const topic = args.topic.trim().slice(0, 120);
    if (topic.length < 2) throw new Error("Enter a topic first.");

    const content = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Cerevyn, an expert exam tutor. Respond with a single valid JSON object only — no markdown fences, no commentary.",
        },
        {
          role: "user",
          content: `Generate the 8 most important exam-style questions for "${topic}" (subject: ${subject}).

Return ONLY valid JSON matching this TypeScript type:
{
  "questions": [
    { "question": string, "answer": string, "difficulty": "easy" | "medium" | "hard" }
  ]
}

Rules:
- Exactly 8 questions that are most likely to appear in exams for this topic.
- "answer": a complete model answer or worked solution (2-6 sentences; show working for numerical problems).
- Spread difficulties: roughly 3 easy, 3 medium, 2 hard.
- Questions must be self-contained and curriculum-appropriate.`,
        },
      ],
      0.4,
      3000,
    );

    const parsed = extractJson(content) as { questions?: unknown };
    const questions = Array.isArray(parsed.questions)
      ? (parsed.questions as Array<Record<string, unknown>>)
          .filter((q) => !!q && typeof q.question === "string" && typeof q.answer === "string")
          .map((q) => ({
            question: String(q.question),
            answer: String(q.answer),
            difficulty:
              q.difficulty === "easy" || q.difficulty === "hard" ? String(q.difficulty) : "medium",
          }))
      : [];
    if (questions.length === 0) {
      throw new Error("AI response was incomplete. Please try again.");
    }

    const id = await ctx.runMutation(api.important.insert, {
      subject,
      topic,
      questions: questions.slice(0, 8),
    });
    return { id, questions: questions.slice(0, 8) };
  },
});

export const insert = mutation({
  args: {
    subject: v.string(),
    topic: v.string(),
    questions: v.array(
      v.object({ question: v.string(), answer: v.string(), difficulty: v.string() }),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    // Replace any previous set for the same topic so there is one canonical list.
    const existing = await ctx.db
      .query("importantQuestions")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topic", args.topic))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    return ctx.db.insert("importantQuestions", {
      userId,
      subject: args.subject,
      topic: args.topic,
      questions: args.questions,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return (
      (
        await ctx.db
          .query("importantQuestions")
          .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topic", args.topic))
          .first()
      ) ?? null
    );
  },
});
