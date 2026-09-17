import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Dumbbell,
  History,
  Loader2,
  RotateCcw,
  Shuffle,
  Target,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSounds, useSettings } from "@/hooks/use-settings";
import { TranslateButton } from "@/components/TranslateButton";
import { maybeShowInterstitial } from "@/lib/ads";
import SnapSolve from "@/components/tutor/SnapSolve";
import TutorChat from "@/components/tutor/TutorChat";
import { Bookmark, Camera, MessageCircleQuestion } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type PracticeQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};
type XpInfo = {
  granted: boolean;
  amount: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  newLevelName: string | null;
};

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "English",
  "Computer Science",
  "Economics",
  "Business Studies",
];

const DIFFICULTIES: Array<{ id: Difficulty; label: string; hint: string }> = [
  { id: "easy", label: "Easy", hint: "recall & basics" },
  { id: "medium", label: "Medium", hint: "application" },
  { id: "hard", label: "Hard", hint: "analysis" },
];

const COUNTS = [10, 20, 30] as const;

const MOTIVATION = [
  "Practice doesn't make perfect — it makes progress. Keep going. ✨",
  "Every question you try makes the next one easier. 🌱",
  "Repetition is how knowing becomes showing. 💪",
  "One drill today, one less doubt tomorrow. 📖",
];

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export default function Practice() {
  const sounds = useSounds();
  const { settings } = useSettings();
  const startAction = useAction(api.practice.start);
  const completeMutation = useMutation(api.practice.complete);
  const historyList = useQuery(api.practice.history);

  const [screen, setScreen] = useState<"setup" | "loading" | "session" | "results">(
    "setup",
  );
  const [replayKey, setReplayKey] = useState(0);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState<number>(10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivation] = useState(() => pick(MOTIVATION));
  const [mode, setMode] = useState<"drills" | "snap" | "saved">("drills");

  const session = useQuery(
    api.practice.get,
    sessionId ? { sessionId: sessionId as never } : "skip",
  );

  const handleStart = async () => {
    if (screen === "loading") return;
    const t = topic.trim();
    if (t.length < 2) {
      setError("Please enter a topic to practice");
      return;
    }
    setScreen("loading");
    setError(null);
    sounds.click();
    try {
      const result = await startAction({
        subject,
        topic: t,
        difficulty,
        count,
      });
      setSessionId(result.sessionId);
      setScreen("session");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^UNAUTHENTICATED:\s*/, "")
          : "Something went wrong. Please try again.",
      );
      setScreen("setup");
    }
  };

  const handleComplete = async (
    answers: number[],
  ): Promise<{ score: number; total: number; percent: number; xp: XpInfo } | null> => {
    if (!sessionId) return null;
    try {
      const result = await completeMutation({
        sessionId: sessionId as never,
        answers,
      });
      if (result.xp.granted) {
        toast.success(`+${result.xp.amount} XP`, {
          description: `${result.xp.totalXp} XP total`,
        });
        sounds.xp();
      }
      if (result.xp.leveledUp) {
        toast.success(
          `Level up! You are now Level ${result.xp.level}${result.xp.newLevelName ? ` — ${result.xp.newLevelName}` : ""}`,
          { duration: 6000 },
        );
        sounds.levelup();
      }
      for (const q of result.settledQuests) {
        toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
      }
      sounds.complete();
      setScreen("results");
      // Natural break: results are already on screen. maybeShowInterstitial
      // internally enforces the 3-minute cooldown and only shows if a loaded
      // ad is ready — otherwise the flow continues untouched.
      void maybeShowInterstitial("practiceResultsInterstitial");
      return result;
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message.replace(/^UNAUTHENTICATED:\s*/, "")
          : "Could not save your session.",
      );
      return null;
    }
  };

  // Re-drill the same session's questions. XP stays idempotent (per-session
  // ref), so replaying can never farm extra XP.
  const practiceAgain = () => {
    setReplayKey((k) => k + 1);
    setScreen("session");
  };

  const tryAnotherTopic = () => {
    setSessionId(null);
    setTopic("");
    setScreen("setup");
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Dumbbell className="size-7 text-primary" /> Practice
        </h1>
        <p className="annotation text-sm">
          drill any topic — or snap a question and let the tutor solve it
        </p>
        {settings.motivationalThoughts && (
          <p className="mt-1 w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
            {motivation}
          </p>
        )}
      </header>

      {/* Mode switcher: Drills / Snap & Solve + AI Tutor / Saved */}
      <div className="flex gap-2">
        {([
          { id: "drills", label: "Drills", icon: Dumbbell },
          { id: "snap", label: "Snap & Solve", icon: Camera },
          { id: "saved", label: "Saved", icon: Bookmark },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              sounds.click();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              mode === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "snap" && <SnapSolve />}

      {mode === "saved" && <SavedQuestions />}

      {mode === "drills" && screen === "setup" && (
        <SetupForm
          subject={subject}
          setSubject={setSubject}
          topic={topic}
          setTopic={setTopic}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          count={count}
          setCount={setCount}
          onStart={handleStart}
          error={error}
        />
      )}

      {mode === "drills" && screen === "loading" && (
        <section className="paper-sheet paper-margin flex flex-col items-center gap-3 px-5 py-12 text-center">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="font-semibold">
            Writing {count} {difficulty} questions on “{topic.trim()}”…
          </p>
          <p className="annotation text-xs">this usually takes a few seconds</p>
        </section>
      )}

      {mode === "drills" && screen === "session" && session && (
        <PracticeRunner
          key={`${session._id}:${replayKey}`}
          questions={session.questions}
          total={session.total}
          onComplete={handleComplete}
        />
      )}

      {mode === "drills" && screen === "results" && session?.status === "completed" && session.answers && (
        <Results
          questions={session.questions}
          answers={session.answers}
          score={session.score ?? 0}
          total={session.total}
          onPracticeAgain={practiceAgain}
          onTryAnotherTopic={tryAnotherTopic}
        />
      )}

      {screen === "setup" &&
        historyList !== undefined &&
        historyList.length > 0 && (
          <section className="paper-sheet spiral-edge px-5 py-4 md:px-7">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <History className="size-4" /> Recent practice
            </h2>
            <ul className="ruled-list mt-2 flex flex-col">
              {historyList.slice(0, 6).map((h) => (
                <li
                  key={h._id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{h.topic}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      · {h.subject} · {h.difficulty}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {h.status === "completed"
                      ? `${h.score ?? 0}/${h.total}`
                      : "in progress"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
    </div>
  );
}

function SetupForm(props: {
  subject: string;
  setSubject: (s: string) => void;
  topic: string;
  setTopic: (t: string) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  count: number;
  setCount: (c: number) => void;
  onStart: () => void;
  error: string | null;
}) {
  return (
    <form
      className="paper-sheet paper-margin px-5 py-4 pl-14 md:pl-16"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      {/* Subject */}
      <label className="text-base font-semibold" htmlFor="subject">
        Subject
      </label>
      <select
        id="subject"
        value={props.subject}
        onChange={(e) => props.setSubject(e.target.value)}
        className="mt-2 h-12 w-full rounded-lg border bg-background/60 px-3 text-base outline-none ring-ring/40 transition focus:ring-2"
      >
        {SUBJECTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Topic */}
      <label className="mt-4 block text-base font-semibold" htmlFor="topic">
        Topic
      </label>
      <input
        id="topic"
        value={props.topic}
        onChange={(e) => props.setTopic(e.target.value)}
        placeholder='e.g. "Quadratic equations" or "Cell division"'
        className="mt-2 h-14 w-full rounded-lg border bg-background/60 px-4 text-base outline-none ring-ring/40 transition focus:ring-2"
        maxLength={120}
      />

      {/* Difficulty */}
      <p className="mt-4 text-base font-semibold">Difficulty</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => props.setDifficulty(d.id)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.98]",
              props.difficulty === d.id
                ? "border-primary bg-primary/10 text-primary"
                : "bg-highlight-soft/60 text-foreground/80 hover:bg-highlight/70",
            )}
          >
            {d.label}
            <span className="text-[11px] font-normal opacity-70">{d.hint}</span>
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="mt-4 text-base font-semibold">Questions</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {COUNTS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => props.setCount(c)}
            className={cn(
              "flex min-h-12 items-center justify-center rounded-lg border px-2 text-sm font-semibold shadow-sm transition active:scale-[0.98]",
              props.count === c
                ? "border-primary bg-primary/10 text-primary"
                : "bg-highlight-soft/60 text-foreground/80 hover:bg-highlight/70",
            )}
          >
            {c} questions
          </button>
        ))}
      </div>

      {props.error && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {props.error}
        </p>
      )}

      <button
        type="submit"
        className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
      >
        <Target className="size-5" />
        Start Practice
      </button>
    </form>
  );
}

function PracticeRunner(props: {
  questions: PracticeQuestion[];
  total: number;
  onComplete: (answers: number[]) => Promise<{
    score: number;
    total: number;
    percent: number;
    xp: XpInfo;
  } | null>;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false); // prevent double submit
  const sounds = useSounds();

  const q = props.questions[index];
  const answersRef = useMemo(() => new Array(props.total).fill(-1), [props.total]);
  const [answers, setAnswers] = useState<number[]>(answersRef);

  if (!q) return null;

  const choose = (oi: number) => {
    if (revealed || submitting || locked) return;
    if (oi === q.correctIndex) sounds.correct();
    else sounds.incorrect();
    setPicked(oi);
    setRevealed(true);
    setAnswers((a) => {
      const next = [...a];
      next[index] = oi;
      return next;
    });
  };

  const next = async () => {
    if (locked || submitting) return;
    if (index + 1 < props.questions.length) {
      setIndex((i) => i + 1);
      setPicked(null);
      setRevealed(false);
      return;
    }
    // Last question → finish session
    setLocked(true);
    setSubmitting(true);
    try {
      await props.onComplete(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const isCorrect = revealed && picked === q.correctIndex;
  const isWrong = revealed && picked !== null && picked !== q.correctIndex;
  const progress = ((index + (revealed ? 1 : 0)) / props.questions.length) * 100;
  const questionPlain = `${q.question}\n${q.options
    .map((o, oi) => `${String.fromCharCode(65 + oi)}) ${o}`)
    .join("\n")}${q.explanation ? `\nWhy: ${q.explanation}` : ""}`;

  return (
    <section className="paper-sheet paper-margin px-5 py-6 pl-14 md:px-8 md:pl-20">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Question {index + 1} / {props.questions.length}
        </span>
        <span className="text-xs text-muted-foreground">
          {props.questions.length - index - 1} to go
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex justify-end">
        <TranslateButton content={questionPlain} />
      </div>

      <p className="mt-5 text-lg font-semibold leading-relaxed">{q.question}</p>

      <div className="mt-4 flex flex-col gap-2.5">
        {q.options.map((opt, oi) => {
          const isPicked = picked === oi;
          const isCorrectOpt = oi === q.correctIndex;
          const showState = revealed && (isPicked || isCorrectOpt);
          return (
            <button
              key={oi}
              onClick={() => choose(oi)}
              disabled={revealed || submitting}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition active:scale-[0.99]",
                !revealed && "bg-card/70 hover:bg-accent",
                showState &&
                  isCorrectOpt &&
                  "border-xp bg-xp/10 font-medium text-xp",
                showState &&
                  isPicked &&
                  !isCorrectOpt &&
                  "border-destructive bg-destructive/10 text-destructive",
                revealed && !showState && "opacity-50",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                {String.fromCharCode(65 + oi)}
              </span>
              <span className="flex-1">{opt}</span>
              {showState && isCorrectOpt && <CheckCircle2 className="size-5 shrink-0" />}
              {showState && isPicked && !isCorrectOpt && (
                <XCircle className="size-5 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className={cn(
            "mt-4 rounded-lg border px-4 py-3",
            isCorrect
              ? "border-xp/40 bg-xp/5"
              : "border-destructive/40 bg-destructive/5",
          )}
        >
          <p className="text-sm font-bold">
            {isCorrect ? "Correct! 🎉" : "Not quite."}
          </p>
          {q.explanation && (
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              <span className="font-semibold">Why: </span>
              {q.explanation}
            </p>
          )}
        </div>
      )}

      <button
        onClick={next}
        disabled={!revealed || submitting}
        className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
      >
        {submitting && <Loader2 className="size-5 animate-spin" />}
        {submitting
          ? "Finishing…"
          : index + 1 < props.questions.length
            ? "Next Question"
            : "See Results"}
      </button>
    </section>
  );
}

function Results(props: {
  questions: PracticeQuestion[];
  answers: number[];
  score: number;
  total: number;
  onPracticeAgain: () => void;
  onTryAnotherTopic: () => void;
}) {
  const incorrect = props.questions
    .map((q, i) => ({ q, i, picked: props.answers[i] }))
    .filter(({ q, picked }) => picked !== q.correctIndex);

  const percent =
    props.total > 0 ? Math.round((props.score / props.total) * 100) : 0;

  return (
    <section className="paper-sheet paper-margin px-5 py-6 pl-14 md:px-8 md:pl-20">
      <h2 className="text-2xl font-bold tracking-tight">Practice complete! 🎉</h2>
      <p className="annotation mt-0.5 text-sm">
        {percent === 100
          ? "Flawless drill — topic mastered!"
          : percent >= 80
            ? "Strong work — exam ready."
            : percent >= 50
              ? "Solid effort. Review and retry."
              : "Keep going — review the explanations and try again."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={`${props.score}/${props.total}`} />
        <Stat label="Accuracy" value={`${percent}%`} />
        <Stat label="Correct" value={`${props.score}`} />
        <Stat label="Incorrect" value={`${props.total - props.score}`} />
      </div>

      {incorrect.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <XCircle className="size-4 text-destructive" /> Review your misses
          </h3>
          <ul className="ruled-list mt-2 flex flex-col">
            {incorrect.map(({ q, i, picked }) => (
              <li key={i} className="py-3 text-sm">
                <p className="font-medium leading-relaxed">{q.question}</p>
                <p className="mt-1 text-destructive">
                  Your answer:{" "}
                  {picked >= 0 ? q.options[picked] : "(skipped)"}
                </p>
                <p className="mt-0.5 text-xp">
                  Correct: {q.options[q.correctIndex]}
                </p>
                {q.explanation && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {q.explanation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={props.onPracticeAgain}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-lg border bg-card px-6 text-base font-bold shadow-sm transition hover:bg-accent active:scale-[0.98]"
        >
          <RotateCcw className="size-5" /> Practice Again
        </button>
        <button
          onClick={props.onTryAnotherTopic}
          className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
        >
          <Shuffle className="size-5" /> Try Another Topic
        </button>
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-highlight-soft/40 px-3 py-3 text-center">
      <p className="text-xl font-bold">{props.value}</p>
      <p className="annotation text-xs">{props.label}</p>
    </div>
  );
}

/** Saved/bookmarked questions with subject filter and reopen-conversation. */
function SavedQuestions() {
  const sounds = useSounds();
  const unsaveMutation = useMutation(api.tutor.unsaveQuestion);
  const [subject, setSubject] = useState<string | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const saved = useQuery(api.tutor.savedList, subject ? { subject } : {});
  const subjects = useQuery(api.tutor.subjects, {});
  const session = useQuery(
    api.tutor.get,
    openSession ? { sessionId: openSession as never } : "skip",
  );

  if (openSession && session) {
    return (
      <section className="paper-sheet spiral-edge flex flex-col gap-4 px-5 py-4 md:px-7">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold">Saved question</h3>
          <button
            type="button"
            onClick={() => setOpenSession(null)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            ← Back to saved
          </button>
        </div>
        <TutorChatLazy
          sessionId={openSession}
          solution={session.solution}
          followUps={session.messages}
        />
      </section>
    );
  }

  return (
    <section className="paper-sheet spiral-edge flex flex-col gap-3 px-5 py-4 md:px-7">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
        <Bookmark className="size-4" /> Saved questions
      </h3>
      {subjects && subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubject(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium",
              subject === null ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
            )}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSubject(s);
                sounds.click();
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                subject === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {saved === undefined ? (
        <Loader2 className="size-5 animate-spin text-primary" />
      ) : saved.length === 0 ? (
        <p className="annotation py-4 text-center text-sm">
          Nothing saved yet. Bookmark questions from Drills or Snap &amp; Solve.
        </p>
      ) : (
        <ul className="ruled-list flex flex-col">
          {saved.map((s) => (
            <li key={s._id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.question}</p>
                <p className="annotation text-xs">
                  {s.subject ?? "General"}
                  {s.topic ? ` · ${s.topic}` : ""} · {s.source}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.tutorSessionId && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenSession(s.tutorSessionId!);
                      sounds.click();
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <MessageCircleQuestion className="size-3.5" /> Reopen
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await unsaveMutation({ id: s._id });
                    toast("Removed from saved questions");
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-accent"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Small wrapper so the TutorChat import stays out of the main bundle path. */
function TutorChatLazy(props: {
  sessionId: string;
  solution: string;
  followUps: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return <TutorChat {...props} />;
}
