"use node";

// This module runs in Node (Convex action runtime). The AI gateway SDK and its
// credentials (VLY_INTEGRATION_KEY) are server-side only — the key is never
// bundled into the web/Android client.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { vly } from "../lib/vly-integrations";
import { requireUserId } from "./identity";
import { api } from "./_generated/api";

export type GenerateResult = {
  noteId: string;
  xp: {
    granted: boolean;
    amount: number;
    totalXp: number;
    level: number;
    leveledUp: boolean;
    newLevelName: string | null;
  };
  settledQuests: Array<{ title: string; xp: number; difficulty: string }>;
};

export type NoteSection = {
  heading: string;
  bullets: string[];
  highlight?: string;
};

export type StudyNotes = {
  topic: string;
  intro: string;
  sections: NoteSection[];
  keyPoints: string[];
  formulas: string[];
  examTips: string[];
  summary: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

function buildPrompt(topic: string) {
  return `You are an expert exam tutor. Create study material for the topic "${topic}".

Return ONLY valid JSON (no markdown fences, no commentary) matching this TypeScript type:

{
  "topic": string,
  "intro": string,
  "sections": [
    {
      "heading": string,
      "bullets": string[],
      "highlight": string
    }
  ],
  "keyPoints": string[],
  "formulas": string[],
  "examTips": string[],
  "summary": string,
  "quiz": [
    { "question": string, "options": [string, string, string, string], "correctIndex": 0, "explanation": string }
  ]
}

Field rules:
- "intro": 2-3 sentence clear explanation of the topic.
- "sections": 4-6 sections covering the important concepts. Each has 3-6 clear, easy-to-understand bullets (include definitions and concrete examples where useful). "highlight" is one key takeaway or definition worth remembering (may be an empty string).
- "keyPoints": 5-8 exam-focused key points.
- "formulas": formulas applicable to the topic in plain text (empty array if none).
- "examTips": 3-5 short exam-focused tips.
- "summary": short summary of the whole topic (3-5 sentences).
- "quiz": exactly 5 multiple-choice questions. Each has exactly 4 options, one correct (correctIndex 0-3), and a 1-2 sentence explanation of why the answer is correct. Mix difficulty levels.

Content must be accurate, curriculum-appropriate, and easy for a student to understand.`;
}

/** Extract the first balanced JSON object from a model response. */
function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Model returned no JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }
  throw new Error("Model returned malformed JSON");
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

export const generate = action({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const topic = args.topic.trim().slice(0, 120);
    if (topic.length < 2) throw new Error("Please enter a topic to study");

    const completion = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Study Notebook AI, an expert exam tutor that outputs strict JSON only.",
        },
        { role: "user", content: buildPrompt(topic) },
      ],
      temperature: 0.4,
      maxTokens: 3000,
    });

    if (!completion.success || !completion.data) {
      throw new Error(
        completion.error ?? "AI generation failed. Please try again.",
      );
    }

    const content = completion.data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as Partial<StudyNotes> & {
      quiz?: unknown;
    };

    const sections: NoteSection[] = Array.isArray(parsed.sections)
      ? (parsed.sections as NoteSection[])
          .filter((s): s is NoteSection => !!s && typeof s === "object")
          .map((s) => ({
            heading: String(s.heading ?? "Notes"),
            bullets: asStringArray(s.bullets),
            highlight:
              typeof s.highlight === "string" && s.highlight.trim()
                ? s.highlight
                : undefined,
          }))
          .filter((s) => s.bullets.length > 0)
      : [];

    if (!parsed.intro || sections.length === 0) {
      throw new Error("AI response was incomplete. Please try again.");
    }

    const quiz: QuizQuestion[] = Array.isArray(parsed.quiz)
      ? (parsed.quiz as QuizQuestion[])
          .filter(
            (q) =>
              q &&
              typeof q.question === "string" &&
              Array.isArray(q.options) &&
              q.options.length === 4 &&
              typeof q.correctIndex === "number" &&
              q.correctIndex >= 0 &&
              q.correctIndex < 4,
          )
          .map((q) => ({
            question: q.question,
            options: q.options.map(String),
            correctIndex: q.correctIndex,
            explanation: String(q.explanation ?? ""),
          }))
      : [];

    const notes: StudyNotes = {
      topic: typeof parsed.topic === "string" ? parsed.topic : topic,
      intro: String(parsed.intro),
      sections,
      keyPoints: asStringArray(parsed.keyPoints),
      formulas: asStringArray(parsed.formulas),
      examTips: asStringArray(parsed.examTips),
      summary: String(parsed.summary ?? ""),
    };

    const result = (await ctx.runMutation(api.notes.saveGenerated, {
      topic,
      notes,
      quiz,
    })) as {
      noteId: string;
      xp: GenerateResult["xp"];
      settledQuests: GenerateResult["settledQuests"];
    };

    return result;
  },
});

/** After a finished quiz attempt: record it, award XP once, progress quests. */
export const recordQuizAttempt = action({
  args: {
    noteId: v.id("notes"),
    score: v.number(),
    total: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    xp: {
      granted: boolean;
      amount: number;
      totalXp: number;
      level: number;
      leveledUp: boolean;
      newLevelName: string | null;
    };
    settledQuests: Array<{ title: string; xp: number; difficulty: string }>;
    percent: number;
  }> => {
    await requireUserId(ctx);
    const percent =
      args.total > 0 ? Math.round((args.score / args.total) * 100) : 0;
    return await ctx.runMutation(api.notes.recordAttempt, {
      noteId: args.noteId,
      score: args.score,
      total: args.total,
      percent,
    });
  },
});
