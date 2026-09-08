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
import { useState } from "react";
import { toast } from "sonner";

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
];

export default function AiStudy() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const generate = useAction(api.ai.generate);
  const notesList = useQuery(api.notes.list);
  const activeNote = useQuery(
    api.notes.get,
    activeNoteId ? { noteId: activeNoteId as never } : "skip",
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
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="size-6 text-primary" /> AI Study
        </h1>
        <p className="annotation text-sm">
          type any topic — instant notes + a quiz
        </p>
      </header>

      {/* Topic input */}
      <form
        className="paper-sheet paper-margin px-5 py-4 pl-14 md:pl-16"
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate(topic);
        }}
      >
        <label htmlFor="topic" className="text-sm font-semibold">
          What are we studying today?
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "Photosynthesis" or "Binomial Distribution"'
            className="h-11 flex-1 rounded-md border bg-background/60 px-3 text-sm outline-none ring-ring/40 transition focus:ring-2"
            disabled={loading}
            maxLength={120}
          />
          <button
            type="submit"
            disabled={loading || topic.trim().length < 2}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GraduationCap className="size-4" />
            )}
            {loading ? "Writing your notes…" : "Generate study pack"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setTopic(s);
                handleGenerate(s);
              }}
              disabled={loading}
              className="rounded-full border bg-highlight-soft/60 px-2.5 py-1 text-xs font-medium text-foreground/80 transition hover:bg-highlight/70 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
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
                  onClick={() => setActiveNoteId(n._id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition-colors hover:text-primary",
                    activeNoteId === n._id && "font-semibold text-primary",
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

      {/* Loading skeleton */}
      {loading && (
        <section className="paper-sheet paper-margin px-5 py-6 pl-14 md:pl-16">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold">
                Studying “{topic.trim()}”…
              </p>
              <p className="annotation text-xs">
                writing notes, examples and a quiz
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {[80, 95, 70, 88].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-muted"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </section>
      )}

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

  return (
    <div className="flex flex-col gap-6">
      <article className="paper-sheet paper-margin px-5 py-6 pl-14 md:px-8 md:pl-20">
        <p className="annotation text-sm">topic notes</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {notes.topic}
        </h2>
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

      {quiz.length > 0 && <QuizCard noteId={noteId} quiz={quiz} />}
    </div>
  );
}

function QuizCard({ noteId, quiz }: { noteId: string; quiz: QuizQuestion[] }) {
  const record = useAction(api.ai.recordQuizAttempt);
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
