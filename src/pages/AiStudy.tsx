import { api } from "@/convex/_generated/api";
import type { GenerateResult, QuizQuestion, StudyNotes } from "@/convex/ai";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  History,
  Lightbulb,
  Loader2,
  Sigma,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSettings, useSounds } from "@/hooks/use-settings";
import { AiProgressCard } from "@/components/loading";
import { TranslateButton } from "@/components/TranslateButton";
import { maybeShowInterstitial } from "@/lib/ads";

type XpInfo = GenerateResult["xp"];

function showXpToasts(xp: XpInfo | undefined, settledQuests: Array<{ title: string; xp: number }> | undefined) {
  if (xp?.granted) {
    toast.success(`+${xp.amount} XP`, {
      description: `${xp.totalXp} XP total`,
    });
  }
  if (xp?.leveledUp) {
    toast.success(`Level up! You are now Level ${xp.level}${xp.newLevelName ? ` — ${xp.newLevelName}` : ""}`, {
      duration: 6000,
    });
  }
  for (const q of settledQuests ?? []) {
    toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
  }
}

const SUGGESTIONS = [
  "Photosynthesis",
  "Binomial Distribution",
  "Marketing Mix",
  "World War 2",
  "Newton's Laws",
  "Supply and Demand",
  "Algebraic expressions",
  "The Water Cycle",
];

const MOTIVATION = [
  "Small progress is still progress. Keep going. ✨",
  "One topic at a time. One step closer to mastering it. 🌱",
  "Every expert was once a beginner. 📖",
  "Notes today, confidence tomorrow. 💪",
];

const SUCCESS_NOTES = [
  "Nice! Your notes are ready. Time to learn. ✨",
  "Fresh notes, fresh start — go get it. 🌟",
  "Your curated notes just landed. Happy studying! 📚",
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export default function AiStudy() {
  const { settings } = useSettings();
  const motivationalThoughts = settings.motivationalThoughts;
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Deep link support: /ai-study?note=<id> opens a saved note directly
  // (used by the Study Library and shared-material cards).
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedNoteId = searchParams.get("note");
  const effectiveNoteId = activeNoteId ?? linkedNoteId;

  const generate = useAction(api.ai.generate);
  const notesList = useQuery(api.notes.list);
  const activeNote = useQuery(
    api.notes.get,
    effectiveNoteId ? { noteId: effectiveNoteId as never } : "skip",
  );

  const handleGenerate = async (rawTopic: string) => {
    const t = rawTopic.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generate({ topic: t });
      setActiveNoteId(result.noteId);
      showXpToasts(result.xp, result.settledQuests);
      toast.success(pick(SUCCESS_NOTES));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^UNAUTHENTICATED:\s*/, "")
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="size-7 text-primary" /> Curated Notes
        </h1>
        <p className="annotation text-sm">
          type any topic — personalized notes + a quiz, written just for you
        </p>
        {motivationalThoughts && (
          <p className="mt-1 w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
            {MOTIVATION[0]}
          </p>
        )}
      </header>

      {/* Topic input */}
      <form
        className="paper-sheet paper-margin px-5 py-4 pl-14 md:pl-16"
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate(topic);
        }}
      >
        <label
          htmlFor="topic"
          className="text-base font-semibold"
        >
          What are we studying today?
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "Photosynthesis" or "Binomial Distribution"'
            className="h-11 flex-1 rounded-lg border bg-background/60 px-3.5 text-sm outline-none ring-ring/40 transition focus:ring-2"
            disabled={loading}
            maxLength={120}
          />
          <button
            type="submit"
            disabled={loading || topic.trim().length < 2}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GraduationCap className="size-4" />
            )}
            {loading ? "Writing your notes…" : "Generate Curated Notes"}
          </button>
        </div>
        <div className="mt-5">
          <p className="annotation mb-2 text-xs">or try one of these:</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTopic(s);
                  handleGenerate(s);
                }}
                disabled={loading}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-highlight-soft/60 px-4 py-2.5 text-sm font-semibold text-foreground/80 shadow-sm transition hover:bg-highlight/70 hover:shadow active:scale-[0.98] disabled:opacity-50"
              >
                <BookOpenCheck className="size-4 shrink-0 text-marker" />
                {s}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </p>
        )}
      </form>

      {/* Library */}
      {notesList !== undefined && notesList.length > 0 && (
        <section className="paper-sheet spiral-edge px-5 py-4 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <History className="size-4" /> Your saved topics
          </h2>
          <ul className="ruled-list mt-2 flex flex-col">
            {notesList.slice(0, 8).map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => { setActiveNoteId(n._id); if (linkedNoteId) setSearchParams({}, { replace: true }); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition-colors hover:text-primary",
                    effectiveNoteId === n._id && "font-semibold text-primary",
                  )}
                >
                  <span className="truncate">{n.topic}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {n.quizCount} questions
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* AI generation loading — animated notebook + rotating study phrases */}
      {loading && <AiProgressCard topic={topic} />}

      {/* Notes + quiz */}
      {activeNote && !loading ? (
        <NoteView noteId={activeNote._id} />
      ) : !loading && notesList !== undefined && notesList.length === 0 ? (
        <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          <BookOpenCheck className="size-8 text-ink-faint" />
          <p className="font-semibold">No notes yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Type any academic topic above and your AI study pack — notes,
            key points, formulas and a quiz — appears here.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function NoteView({ noteId }: { noteId: string }) {
  const note = useQuery(api.notes.get, { noteId: noteId as never });
  if (!note) return null;
  const notes = note.notes as StudyNotes;
  const quiz = note.quiz as QuizQuestion[];

  // One shared translation of the whole notes document, on demand.
  const notesPlain = [
    notes.topic,
    notes.intro,
    ...notes.sections.map(
      (s) =>
        `${s.heading}\n${s.bullets.map((b) => `- ${b}`).join("\n")}${s.highlight ? `\n★ ${s.highlight}` : ""}`,
    ),
    ...notes.keyPoints.map((k) => `✓ ${k}`),
    ...notes.formulas.map((f) => `[formula] ${f}`),
    ...notes.examTips.map((t) => `💡 ${t}`),
    notes.summary ? `Summary\n${notes.summary}` : "",
  ].join("\n\n");

  return (
    <div className="flex flex-col gap-6">
      <ImportantQuestions topic={notes.topic} />
      <article className="paper-sheet paper-margin px-5 py-6 pl-14 md:px-8 md:pl-20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="annotation text-sm">topic notes</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {notes.topic}
            </h2>
          </div>
          <TranslateButton content={notesPlain} />
        </div>
        <p className="mt-3 leading-relaxed text-foreground/90">{notes.intro}</p>

        {notes.sections.map((s, i) => (
          <section key={i} className="mt-6">
            <h3 className="flex items-baseline gap-2 text-lg font-bold">
              <span className="text-sm text-marker">{i + 1}.</span> {s.heading}
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.bullets.map((b, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-faint" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {s.highlight && (
              <p className="mt-3 inline-block rounded bg-highlight-soft px-2 py-1 text-sm font-medium">
                ★ {s.highlight}
              </p>
            )}
          </section>
        ))}

        {notes.keyPoints.length > 0 && (
          <section className="mt-7">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Star className="size-4 text-highlight" /> Key exam points
            </h3>
            <ul className="ruled-list mt-2 flex flex-col">
              {notes.keyPoints.map((k, i) => (
                <li key={i} className="py-1.5 text-sm leading-relaxed">
                  ✓ {k}
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.formulas.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Sigma className="size-4 text-primary" /> Formulas
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {notes.formulas.map((f, i) => (
                <code
                  key={i}
                  className="rounded-md border bg-paper-deep px-3 py-2 text-sm font-medium"
                >
                  {f}
                </code>
              ))}
            </div>
          </section>
        )}

        {notes.examTips.length > 0 && (
          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Lightbulb className="size-4 text-marker" /> Exam tips
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {notes.examTips.map((t, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  💡 {t}
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.summary && (
          <section className="mt-7 rounded-lg border-l-4 border-highlight bg-highlight-soft/50 px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Summary
            </h3>
            <p className="mt-1 text-sm leading-relaxed">{notes.summary}</p>
          </section>
        )}
      </article>

      {quiz.length > 0 && (
        <QuizCard noteId={noteId} quiz={quiz} topic={notes.topic} />
      )}
    </div>
  );
}

function QuizCard({ noteId, quiz, topic }: { noteId: string; quiz: QuizQuestion[]; topic: string }) {
  const record = useAction(api.ai.recordQuizAttempt);
  const saveMistakes = useMutation(api.revision.saveMistakes);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const score = quiz.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const percent = Math.round((score / quiz.length) * 100);

  const submit = async () => {
    if (submitted || Object.keys(answers).length < quiz.length) return;
    setSubmitted(true);
    setSaving(true);
    try {
      const result = await record({ noteId: noteId as never, score, total: quiz.length });
      showXpToasts(result.xp, result.settledQuests);
      // Natural break: quiz results are already on screen.
      void maybeShowInterstitial("quizResultsInterstitial");
      // Save wrong answers for Smart Revision (fire-and-forget, idempotent).
      const wrong = quiz
        .map((q, i) => ({ q, i }))
        .filter(({ q, i }) => answers[i] !== q.correctIndex)
        .map(({ q }) => ({
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        }));
      if (wrong.length > 0) {
        try {
          await saveMistakes({ noteId: noteId as never, topic, mistakes: wrong });
          toast.info(
            `${wrong.length} mistake${wrong.length === 1 ? "" : "s"} added to your Revision queue`,
          );
        } catch {
          // Non-fatal: quiz result already saved.
        }
      }
    } catch {
      toast.error("Could not save your attempt, but your score is shown.");
    } finally {
      setSaving(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <article className="paper-sheet spiral-edge px-5 py-6 md:px-8">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <BookOpenCheck className="size-5 text-primary" /> Quiz yourself
      </h2>
      <p className="annotation mt-0.5 text-xs">
        pick an answer — you'll see why it's right
      </p>
      <div className="mt-2">
        <TranslateButton
          content={quiz
            .map(
              (q, i) =>
                `${i + 1}. ${q.question}\n${q.options
                  .map((o, oi) => `${String.fromCharCode(65 + oi)}) ${o}`)
                  .join("\n")}\nWhy: ${q.explanation}`,
            )
            .join("\n\n")}
        />
      </div>

      <ol className="mt-5 flex flex-col gap-6">
        {quiz.map((q, qi) => {
          const picked = answers[qi];
          return (
            <li key={qi} className="rounded-lg border bg-card/60 p-4">
              <p className="text-sm font-semibold leading-relaxed">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const isPicked = picked === oi;
                  const isCorrect = oi === q.correctIndex;
                  const showState = submitted && (isPicked || isCorrect);
                  return (
                    <button
                      key={oi}
                      onClick={() => !submitted && setAnswers((a) => ({ ...a, [qi]: oi }))}
                      disabled={submitted}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
                        !submitted && isPicked && "border-primary bg-primary/10 font-medium",
                        !submitted && !isPicked && "hover:bg-accent",
                        showState && isCorrect && "border-xp bg-xp/10 font-medium text-xp",
                        showState && isPicked && !isCorrect && "border-destructive bg-destructive/10 text-destructive",
                      )}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {showState && isCorrect && <CheckCircle2 className="size-4 shrink-0" />}
                      {showState && isPicked && !isCorrect && <XCircle className="size-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <p className="mt-3 rounded-md bg-paper-deep px-3 py-2 text-xs leading-relaxed text-foreground/80">
                  <span className="font-semibold">Why: </span>
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted ? (
        <button
          onClick={submit}
          disabled={Object.keys(answers).length < quiz.length || saving}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {Object.keys(answers).length < quiz.length
            ? `Answer all ${quiz.length} questions (${Object.keys(answers).length}/${quiz.length})`
            : "Finish quiz & claim XP"}
        </button>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border bg-highlight-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold">
              Score: {score}/{quiz.length}{" "}
              <span className={cn("text-sm font-semibold", percent >= 80 ? "text-xp" : percent >= 50 ? "text-foreground" : "text-destructive")}>
                ({percent}%)
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {percent === 100
                ? "Flawless! Your notes paid off."
                : percent >= 80
                  ? "Great work — exam ready."
                  : percent >= 50
                    ? "Solid effort. Review the notes and retry."
                    : "Keep going — reread the key points and try again."}
            </p>
          </div>
          <button
            onClick={retry}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-semibold transition hover:bg-accent"
          >
            Retry quiz
          </button>
        </div>
      )}
    </article>
  );
}

/* ─── Important Questions — exam-style questions for the current topic ──── */

type ImportantQ = {
  _id: string;
  subject: string;
  topic: string;
  questions: Array<{ question: string; answer: string; difficulty: string }>;
};

const DIFF_STYLE: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  hard: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function ImportantQuestions({ topic }: { topic: string }) {
  const saved = useQuery(api.important.get, { topic });
  const generateImportant = useAction(api.important.generate);
  const saveQ = useMutation(api.tutor.saveQuestion);
  const sounds = useSounds();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [savedMsgs, setSavedMsgs] = useState<Record<number, boolean>>({});

  const data = saved as ImportantQ | null | undefined;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await generateImportant({ subject: "General", topic });
      sounds.unlock();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^UNAUTHENTICATED:\s*/, "")
          : "Could not generate questions. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="paper-sheet px-5 py-5 md:px-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          <Lightbulb className="size-4 text-highlight" /> Important questions
        </h2>
        {data === undefined ? null : (
          <button
            type="button"
            onClick={() => {
              sounds.click();
              void run();
            }}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="inline size-3.5 animate-spin" />
            ) : (
              <Sparkles className="inline size-3.5" />
            )} {data ? "Regenerate" : "Generate"}
          </button>
        )}
      </div>

      {busy && (
        <AiProgressCard topic={topic} detail="picking the exam essentials" />
      )}
      {error && (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {data && data.questions.length > 0 && (
        <ol className="ruled-list mt-3 flex flex-col">
          {data.questions.map((q, i) => (
            <li key={i} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setOpenIdx(openIdx === i ? null : i);
                  }}
                  className="min-w-0 flex-1 text-left text-sm font-medium leading-snug hover:text-primary"
                >
                  <span className="mr-1.5 text-marker">Q{i + 1}.</span>
                  {q.question}
                </button>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.medium,
                  )}
                >
                  {q.difficulty}
                </span>
              </div>
              {openIdx === i && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border bg-paper-deep/60 p-3">
                  <p className="text-sm leading-relaxed text-foreground/90">{q.answer}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/practice"
                      onClick={sounds.click}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Practice this topic
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await saveQ({
                            source: "important",
                            subject: data.subject,
                            topic: data.topic,
                            question: q.question,
                            answer: q.answer,
                          });
                          setSavedMsgs((m) => ({ ...m, [i]: true }));
                          sounds.success();
                        } catch {
                          toast.error("Could not save the question");
                        }
                      }}
                      disabled={savedMsgs[i]}
                      className="rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent disabled:opacity-50"
                    >
                      {savedMsgs[i] ? "Saved ✓" : "Save question"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {data === null && !busy && (
        <p className="annotation mt-3 text-xs">
          tap “Generate” to get the 8 questions most likely to appear in your exam.
        </p>
      )}
    </section>
  );
}
