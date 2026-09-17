import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { requireUserId } from "./identity";
import { chatCompletion } from "./ai";

const MAX_IMAGE_CHARS = 900_000; // ~650KB binary → base64 ≈ 870KB

const TUTOR_SYSTEM =
  "You are Learnova, a patient expert tutor for school and college students. " +
  "Solve problems step by step, clearly and correctly. Use short numbered steps, " +
  "plain language, and highlight the final answer. Never invent facts. " +
  "Format with markdown-style headings and bullet lists (plain text).";

/** ─── Snap & Solve: send a photo (and optional typed note) to the AI ────── */
export const solve = action({
  args: {
    image: v.optional(v.string()), // data URL
    questionText: v.optional(v.string()),
    subject: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ sessionId: string }> => {
    await requireUserId(ctx);
    const hasImage = !!args.image;
    const hasText = !!args.questionText && args.questionText.trim().length > 1;
    if (!hasImage && !hasText) {
      throw new Error("Snap a photo or type the question first.");
    }
    if (hasImage && args.image!.length > MAX_IMAGE_CHARS) {
      throw new Error("Image is too large — please try a smaller photo.");
    }

    const userContent: string | Array<{ type: string; [k: string]: unknown }> =
      hasImage
        ? [
            {
              type: "text",
              text:
                "Solve the question shown in this image step by step." +
                (hasText ? ` Additional note from the student: ${args.questionText}` : ""),
            },
            { type: "image_url", image_url: { url: args.image! } },
          ]
        : `Solve this question step by step: ${args.questionText}`;

    const content = await chatCompletion(
      [
        { role: "system", content: TUTOR_SYSTEM },
        { role: "user", content: userContent as never },
      ],
      0.3,
      2200,
    );
    if (!content.trim()) throw new Error("The AI could not read that. Try a clearer photo.");

    const sessionId = await ctx.runMutation(api.tutor.insertSession, {
      subject: args.subject?.slice(0, 60),
      topic: args.topic?.slice(0, 120),
      questionText: args.questionText?.slice(0, 2000),
      image: hasImage ? args.image : undefined,
      solution: content,
    });
    return { sessionId };
  },
});

/** ─── Follow-up: continue an existing tutor conversation ─────────────────── */
export const followUp = action({
  args: {
    sessionId: v.id("tutorSessions"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    await requireUserId(ctx);
    const text = args.message.trim().slice(0, 2000);
    if (!text) throw new Error("Type a question first.");

    const s = await ctx.runQuery(api.tutor.getInternal, { sessionId: args.sessionId });
    if (!s) throw new Error("Session not found.");

    const history = s.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const conversation = [
      { role: "system" as const, content: TUTOR_SYSTEM },
      ...(s.image
        ? [
            {
              role: "user" as const,
              content: [
                { type: "text", text: "The original question was in this image." },
                { type: "image_url", image_url: { url: s.image } },
              ] as never,
            },
          ]
        : s.questionText
          ? [{ role: "user" as const, content: `Original question: ${s.questionText}` }]
          : []),
      { role: "user" as const, content: s.solution },
      { role: "assistant" as const, content: "Here is the full solution above. Ask me anything about it." },
      ...history,
      { role: "user" as const, content: text },
    ];

    const reply = await chatCompletion(conversation as never, 0.4, 1600);
    if (!reply.trim()) throw new Error("The tutor could not respond. Try again.");

    await ctx.runMutation(api.tutor.appendMessage, {
      sessionId: args.sessionId,
      userMessage: text,
      assistantMessage: reply,
    });
    return reply;
  },
});

/** Preset tutor actions (explain simply, hint, example…) reuse followUp. */
export const tutorAction = action({
  args: {
    sessionId: v.id("tutorSessions"),
    action: v.union(
      v.literal("simple"),
      v.literal("steps"),
      v.literal("example"),
      v.literal("previous"),
      v.literal("hint"),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    await requireUserId(ctx);
    const prompts = {
      simple: "Explain the solution to me in the simplest possible way, as if I am new to this topic.",
      steps: "Break the solution down into numbered steps with a one-line explanation for each.",
      example: "Give me one similar worked example so I can practice the same method.",
      previous: "Explain the previous step of the solution again in more detail.",
      hint: "Don't give me the answer — just give me a hint to work it out myself.",
    } as const;
    const reply = await ctx.runAction(api.tutor.followUp, {
      sessionId: args.sessionId,
      message: prompts[args.action],
    });
    return reply;
  },
});

/** ─── Persistence helpers (mutations, internal use from actions) ─────────── */

export const insertSession = mutation({
  args: {
    subject: v.optional(v.string()),
    topic: v.optional(v.string()),
    questionText: v.optional(v.string()),
    image: v.optional(v.string()),
    solution: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    return ctx.db.insert("tutorSessions", {
      userId,
      subject: args.subject,
      topic: args.topic,
      questionText: args.questionText,
      image: args.image,
      solution: args.solution,
      messages: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const appendMessage = mutation({
  args: {
    sessionId: v.id("tutorSessions"),
    userMessage: v.string(),
    assistantMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.userId !== (await requireUserId(ctx))) {
      throw new Error("Session not found.");
    }
    await ctx.db.patch(s._id, {
      messages: [
        ...s.messages,
        { role: "user" as const, content: args.userMessage },
        { role: "assistant" as const, content: args.assistantMessage },
      ],
      updatedAt: Date.now(),
    });
  },
});

export const getInternal = query({
  args: { sessionId: v.id("tutorSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.userId !== userId) return null;
    return s;
  },
});

/** ─── Client-facing queries ──────────────────────────────────────────────── */

export const get = query({
  args: { sessionId: v.id("tutorSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s || s.userId !== userId) return null;
    return s;
  },
});

/** History of solved questions (own only, newest first). */
export const history = query({
  args: { subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let rows;
    if (args.subject) {
      rows = await ctx.db
        .query("tutorSessions")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(60);
      rows = rows.filter((r) => r.subject === args.subject);
    } else {
      rows = await ctx.db
        .query("tutorSessions")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(30);
    }
    return rows.map((s) => ({
      _id: s._id,
      subject: s.subject ?? null,
      topic: s.topic ?? null,
      questionText: s.questionText ?? null,
      hasImage: !!s.image,
      solutionPreview: s.solution.slice(0, 140),
      status: s.status,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
    }));
  },
});

/** ─── Saved questions ────────────────────────────────────────────────────── */

export const saveQuestion = mutation({
  args: {
    source: v.string(),
    sourceId: v.optional(v.string()),
    subject: v.optional(v.string()),
    topic: v.optional(v.string()),
    question: v.string(),
    answer: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctIndex: v.optional(v.number()),
    tutorSessionId: v.optional(v.id("tutorSessions")),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    // Idempotent: same source+question never saved twice.
    const existing = await ctx.db
      .query("savedQuestions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .take(200);
    const dup = existing.find(
      (r) => r.question.trim() === args.question.trim() && r.source === args.source,
    );
    if (dup) return dup._id;
    return ctx.db.insert("savedQuestions", { userId, ...args, createdAt: Date.now() });
  },
});

export const unsaveQuestion = mutation({
  args: { id: v.id("savedQuestions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (row && row.userId === userId) await ctx.db.delete(args.id);
  },
});

export const savedList = query({
  args: { subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    let rows = await ctx.db
      .query("savedQuestions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    if (args.subject) rows = rows.filter((r) => r.subject === args.subject);
    return rows;
  },
});

/** Distinct subjects the user has saved/history for filter chips. */
export const subjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const saved = await ctx.db
      .query("savedQuestions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .take(200);
    const set = new Set<string>();
    for (const r of saved) if (r.subject) set.add(r.subject);
    return Array.from(set).sort();
  },
});
