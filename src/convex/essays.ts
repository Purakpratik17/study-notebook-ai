import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireUserId } from "./identity";
import { aiRateGuard } from "./ai";
import { api } from "./_generated/api";

/**
 * Essay Writer — reuses the exact same NVIDIA integration as AI Study
 * (`chatCompletion` in ai.ts, model deepseek-ai/deepseek-v4.1-flash,
 * key from process.env.NVIDIA_API_KEY). No new providers or keys.
 */
import { chatCompletion } from "./ai";

export type EssayResult = {
  essayId: string;
  title: string;
  content: string;
  wordCount: number;
};

function essayPrompt(opts: {
  topic: string;
  subject?: string;
  length: string;
  level: string;
  tone: string;
  keyPoints?: string;
  instruction?: string;
}) {
  return `Write a well-structured academic essay.

Topic: ${opts.topic}
Subject: ${opts.subject || "General"}
Required length: ${opts.length}
Academic level: ${opts.level}
Tone/style: ${opts.tone}
${opts.keyPoints ? `Key points to cover: ${opts.keyPoints}` : ""}
${opts.instruction ? `Additional instruction: ${opts.instruction}` : ""}

Requirements:
- Start with a title on the first line (no markdown #).
- Then "Introduction:", body sections with clear headings, examples where appropriate, and a "Conclusion:".
- Plain text only — no markdown symbols, no bullet lists; use headings and paragraphs.
- Meet the required length as closely as possible.`;
}

async function generateEssayText(prompt: string, maxTokens: number, userKey: string): Promise<{ title: string; content: string }> {
  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You are an expert academic essay writer. Respond with plain text only — a title line followed by the essay. No markdown formatting symbols.",
      },
      { role: "user", content: prompt },
    ],
    0.6,
    maxTokens,
    userKey,
  );
  const lines = raw.trim().split("\n");
  const title = (lines[0] ?? "Untitled Essay").replace(/^#+\s*/, "").slice(0, 120);
  const content = lines.slice(1).join("\n").trim() || raw.trim();
  return { title, content };
}

export const generate = action({
  args: {
    topic: v.string(),
    subject: v.optional(v.string()),
    length: v.string(), // e.g. "500 words", "1000 words"
    level: v.string(), // e.g. "High school", "College"
    tone: v.string(), // e.g. "Formal", "Simple"
    keyPoints: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<EssayResult> => {
    const userId = await requireUserId(ctx);
    await aiRateGuard(ctx, userId, "generate");
    const topic = args.topic.trim().slice(0, 150);
    if (topic.length < 3) throw new Error("Please enter an essay topic");

    const { title, content } = await generateEssayText(
      essayPrompt({ ...args, topic, instruction: "" }),
      3200,
      userId,
    );
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const essayId = await ctx.runMutation(api.essays.save, {
      title,
      topic,
      subject: args.subject,
      content,
      wordCount,
    });
    return { essayId, title, content, wordCount };
  },
});

/** Revision modes applied to an existing essay text. */
export const revise = action({
  args: {
    mode: v.union(
      v.literal("expand"),
      v.literal("shorten"),
      v.literal("simplify"),
      v.literal("formal"),
      v.literal("regenerate"),
    ),
    title: v.string(),
    topic: v.string(),
    subject: v.optional(v.string()),
    level: v.optional(v.string()),
    current: v.string(),
  },
  handler: async (ctx, args): Promise<{ title: string; content: string; wordCount: number }> => {
    const userId = await requireUserId(ctx);
    await aiRateGuard(ctx, userId, "generate");
    const modeText = {
      expand: "Expand this essay with more detail, examples and depth. Keep the same structure.",
      shorten: "Shorten this essay to about half its length while keeping the key arguments.",
      simplify: "Simplify the language so a younger student can easily understand it. Keep the structure.",
      formal: "Rewrite in a more formal, academic register. Keep the same content and structure.",
      regenerate: "Write a fresh essay on the same topic with a different angle.",
    }[args.mode];

    const { title, content } = await generateEssayText(
      `${modeText}

Original essay:
"""
${args.current.slice(0, 8000)}
"""`,
      3200,
      userId,
    );
    const finalTitle = args.mode === "regenerate" ? title : args.title;
    return {
      title: finalTitle,
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  },
});

export const save = mutation({
  args: {
    title: v.string(),
    topic: v.string(),
    subject: v.optional(v.string()),
    content: v.string(),
    wordCount: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("essays", {
      userId,
      title: args.title.slice(0, 120),
      topic: args.topic.slice(0, 150),
      subject: args.subject?.slice(0, 80),
      content: args.content.slice(0, 40_000),
      wordCount: args.wordCount,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContent = mutation({
  args: { essayId: v.id("essays"), content: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUserId(ctx);
    const essay = await ctx.db.get(args.essayId);
    if (!essay || essay.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.essayId, {
      content: args.content.slice(0, 40_000),
      wordCount: args.content.split(/\s+/).filter(Boolean).length,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("essays")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const getEssay = query({
  args: { essayId: v.id("essays") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const essay = await ctx.db.get(args.essayId);
    if (!essay || essay.userId !== userId) return null;
    return essay;
  },
});
