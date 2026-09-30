"use node";

// This module runs in Node (Convex action runtime). The AI provider key lives
// only in the Convex deployment environment (NVIDIA_API_KEY) and is never
// bundled into the web/Android client.

// NVIDIA NIM gateway — OpenAI-compatible chat completions endpoint.
// Model list verified live against GET /v1/models (2026-09). Primary is
// deepseek-v4.1-flash; openai/gpt-oss-20b is a verified-live fallback on
// the same gateway & key (see chatCompletion docs).
const AI_BASE_URL = "https://integrate.api.nvidia.com/v1";

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

/**
 * Shared chat completion with latency safeguards:
 * • Per-attempt timeout so a hung request is handled cleanly.
 * • Limited retries (2) with exponential backoff for transient failures
 *   (timeouts, network errors, 429/5xx). Never retried: 4xx auth/request
 *   errors — those need a config fix, not a retry.
 * • Provider fallback: NVIDIA's hosted deepseek-v4.1-flash endpoint can
 *   hold requests open indefinitely under load (verified live: a trivial
 *   "say ok" request hangs >120s while other models answer in <1s). If
 *   it times out on every attempt we transparently retry the SAME request
 *   against a verified-live fallback model served by the same gateway,
 *   same key, same request shape — then re-raise so callers see a clean
 *   user-friendly error.
 * • Server-side diagnostics: duration and outcome are logged; keys and
 *   message contents are never logged.
 */
const AI_MODELS = [
  "deepseek-ai/deepseek-v4.1-flash", // primary (same as before)
  "openai/gpt-oss-20b", // fallback, verified live on the same gateway
];
const AI_TIMEOUT_MS = 45_000;
const AI_RETRIES = 2; // per model: 1 initial + 2 retries
const AI_BACKOFF_BASE_MS = 1_000;

export async function chatCompletion(
  messages: Array<{ role: string; content: ChatContent }>,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI is not configured: NVIDIA_API_KEY is missing from the backend environment.",
    );
  }

  let lastError: Error = new Error("AI request failed");

  for (const model of AI_MODELS) {
    for (let attempt = 0; attempt <= AI_RETRIES; attempt++) {
      const started = Date.now();
      try {
        const content = await singleChatCompletion(
          model,
          messages,
          temperature,
          maxTokens,
          apiKey,
        );
        console.log(
          `[ai] ok model=${model} attempt=${attempt} ms=${Date.now() - started} tokens<=${maxTokens}`,
        );
        return content;
      } catch (err) {
        const e =
          err instanceof Error ? err : new Error("Unknown AI error");
        lastError = e;
        const retryable = isRetryable(e);
        console.error(
          `[ai] fail model=${model} attempt=${attempt} ms=${Date.now() - started} retryable=${retryable} kind=${errorKind(e)}`,
        );
        if (!retryable || attempt === AI_RETRIES) break;
        await sleep(AI_BACKOFF_BASE_MS * 2 ** attempt); // 1s, 2s
      }
    }
  }

  // Every model & attempt exhausted — clean, user-friendly message.
  if (lastError.message.includes("took too long")) {
    throw new Error(
      "The AI service is busy right now and couldn't finish in time. Please try again in a minute.",
    );
  }
  if (
    lastError.message.includes("rejected the API key") ||
    lastError.message.includes("not configured")
  ) {
    throw lastError; // config problems should surface as-is
  }
  throw new Error(
    "The AI service couldn't complete your request just now. Please try again.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Transient failures worth retrying: timeouts, network errors, 429/5xx. */
function isRetryable(e: Error): boolean {
  if (e.name === "AbortError" || e.message.includes("took too long")) return true;
  if (e.message.includes("provider error")) {
    const m = /provider error \((\d{3})\)/.exec(e.message);
    if (m) {
      const status = Number(m[1]);
      return status === 429 || status >= 500;
    }
    return true; // unknown provider error shape — likely transient
  }
  return e.message.includes("fetch failed") || e.message.includes("network");
}

/** Short diagnostic bucket for logs — never includes key or content. */
function errorKind(e: Error): string {
  if (e.name === "AbortError" || e.message.includes("took too long")) return "timeout";
  const m = /provider error \((\d{3})\)/.exec(e.message);
  if (m) return `http_${m[1]}`;
  if (e.message.includes("not configured")) return "config";
  return "network_or_unknown";
}

async function singleChatCompletion(
  model: string,
  messages: Array<{ role: string; content: ChatContent }>,
  temperature: number,
  maxTokens: number,
  apiKey: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        top_p: 1,
        max_tokens: maxTokens,
        stream: false,
        // Suppress chain-of-thought preamble on reasoning-capable models.
        // (Only understood by some models — harmless for the rest.)
        chat_template_kwargs: { thinking: false },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "AI provider rejected the API key (HTTP " +
            res.status +
            "). Check that NVIDIA_API_KEY in the Convex environment is a valid, non-revoked key.",
        );
      }
      throw new Error(
        `AI provider error (${res.status}): ${body.slice(0, 200) || res.statusText}`,
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("The AI took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
import { v } from "convex/values";
import { action } from "./_generated/server";
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
- "intro": ONE sentence — a crisp, plain-language definition of the topic.
- "sections": 3-4 sections, each named with a 2-4 word heading. Each has 3 bullets, each bullet ONE short sentence (max 14 words) — a fact, definition or example, never padding.
- "highlight" per section: one key term or formula fragment (max 10 words) or an empty string.
- "keyPoints": 4-5 exam-focused key points, each one short sentence (max 14 words).
- "formulas": formulas applicable to the topic in plain text (empty array if none).
- "examTips": 3 short exam-focused tips (max 12 words each).
- "summary": 2 sentences maximum.
- "quiz": exactly 5 multiple-choice questions. Each has exactly 4 options, one correct (correctIndex 0-3), and a 1-sentence explanation of why the answer is correct.

Style rules:
- Headings and bullets must work as nodes on a mind map: short, concrete, scannable.
- NEVER write paragraphs. NEVER exceed the word limits. No filler phrases like "it is important to note".
- Content must be accurate, curriculum-appropriate, and easy for a student to understand.`;
}

/** Extract the first balanced JSON object from a model response. */
export function extractJson(text: string): unknown {
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

    const content = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Cerevyn, an expert exam tutor. Respond with a single valid JSON object only — no markdown fences, no commentary. Put the quiz under the top-level key \"quiz\".",
        },
        { role: "user", content: buildPrompt(topic) },
      ],
      0.4,
      2400,
    );

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
