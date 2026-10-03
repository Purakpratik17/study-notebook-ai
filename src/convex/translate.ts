import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireUserId } from "./identity";
import { chatCompletion, aiRateGuard } from "./ai";

/**
 * On-demand study-content translation through the existing server-side AI.
 * The key goes nowhere near the client; the model receives the text plus
 * strict formatting rules so equations, MCQ numbering and structure survive.
 */
export const translate = action({
  args: {
    text: v.string(),
    targetLanguage: v.string(),
    sourceLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ translated: string }> => {
    const userId = await requireUserId(ctx);
    await aiRateGuard(ctx, userId, "generate");

    const text = args.text.slice(0, 12_000);
    if (!text.trim()) return { translated: text };

    const target = args.targetLanguage.slice(0, 40);
    const source = args.sourceLanguage?.slice(0, 40) ?? "English";

    const content = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Cerevyn's academic translator. You translate study material with complete fidelity to formatting, notation and structure. Output ONLY the translated text — no preamble, no commentary, no code fences.",
        },
        {
          role: "user",
          content: `Translate the following study material from ${source} into ${target}.

STRICT RULES:
1. Preserve ALL mathematical formulas, equations and symbols exactly as written (e.g. x² + 2x + 1, ∑, ∫, f'(x), ½gt²). Never convert, simplify or reformat them.
2. Preserve scientific notation, units and numerical values exactly.
3. Preserve headings, bullet points, numbering, line breaks and any MCQ structure ("1.", "A)", "(a)") exactly.
4. Do NOT translate code snippets, usernames, URLs or email addresses.
5. Keep widely-recognized proper nouns (e.g. Newton, Photosynthesis as a discipline name, MIT) unchanged unless a standard local term exists.
6. Keep the register educational and clear; the meaning must be exactly preserved.
7. Output ONLY the translated text in the same layout as the input.

TEXT TO TRANSLATE:
---
${text}
---`,
        },
      ],
      0.2,
      4000,
      userId,
    );

    const translated = content.trim();
    if (!translated) {
      throw new Error("Translation came back empty. Please try again.");
    }
    return { translated };
  },
});
