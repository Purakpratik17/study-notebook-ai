import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";

type Queue = {
  overdueCards: number;
  dueTodayCards: number;
  upcomingCards: number;
  mistakes: Array<{
    _id: string;
    topic: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>;
  weakTopics: Array<{ topic: string; percent: number }>;
  total: number;
};

export default function Revision() {
  const sounds = useSounds();
  const queue = useQuery(api.revision.queue) as Queue | undefined;
  const answerMistake = useMutation(api.revision.answerMistake);
  const completeRevision = useMutation(api.revision.completeRevision);

  const [answered, setAnswered] = useState<Record<string, { choice: number; correct: boolean }>>({});
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);

  const remaining = queue ? queue.mistakes.filter((m) => !answered[m._id]) : [];

  const pick = async (mistakeId: string, choice: number) => {
    if (answered[mistakeId]) return;
    try {
      const r = await answerMistake({ mistakeId: mistakeId as never, choiceIndex: choice });
      setAnswered((a) => ({ ...a, [mistakeId]: { choice, correct: r.correct } }));
      if (r.correct) sounds.correct();
      else sounds.incorrect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save answer.");
    }
  };

  const finish = async () => {
    if (finishing || queue === undefined) return;
    setFinishing(true);
    try {
      const items = Object.keys(answered).length;
      if (items > 0) {
        const r = await completeRevision({ itemsReviewed: items });
        if (r.xp.granted) toast.success(`+${r.xp.amount} XP — revision done!`);
        for (const q of r.settledQuests) toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        sounds.complete();
      }
      setFinished(true);
    } catch {
      toast.error("Could not save revision session.");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">🔁 Smart Revision</h1>
        <p className="annotation text-sm">
          built from your real mistakes and due flashcards — nothing fake
        </p>
      </header>

      {queue === undefined ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : queue.total === 0 && finished ? (
        <section className="paper-sheet flex flex-col items-center gap-3 px-6 py-14 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <p className="text-lg font-bold">Revision saved!</p>
          <button
            type="button"
            onClick={() => {
              setFinished(false);
              setAnswered({});
            }}
            className="mt-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Check for more
          </button>
        </section>
      ) : queue.total === 0 ? (
        <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="text-4xl">🌿</span>
          <p className="text-lg font-bold">You're all caught up!</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            No overdue topics, no due flashcards and no unresolved quiz mistakes.
            Come back after your next quiz or review session.
          </p>
          <Link
            to="/ai-study"
            onClick={sounds.click}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Sparkles className="size-4" /> Study something new
          </Link>
        </section>
      ) : (
        <>
          {/* Status rows */}
          <div className="paper-sheet flex flex-col px-5 py-4">
            <QueueRow
              tone="red"
              label={`🔴 Overdue flashcards`}
              count={queue.overdueCards}
            />
            <QueueRow
              tone="orange"
              label={`🟠 Due today`}
              count={queue.dueTodayCards}
            />
            <QueueRow
              tone="green"
              label={`🟢 Upcoming`}
              count={queue.upcomingCards}
              last
            />
          </div>

          {(queue.overdueCards > 0 || queue.dueTodayCards > 0) && (
            <Link
              to="/flashcards"
              onClick={sounds.click}
              className="flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
            >
              <span>Review {queue.overdueCards + queue.dueTodayCards} due flashcards</span>
              <ArrowRight className="size-5" />
            </Link>
          )}

          {/* Incorrect quiz questions */}
          {queue.mistakes.length > 0 && (
            <section className="paper-sheet px-5 py-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
                <AlertTriangle className="size-4 text-destructive" /> Quiz mistakes to fix (
                {remaining.length} left)
              </h2>
              <ul className="mt-4 flex flex-col gap-5">
                {queue.mistakes.map((m) => {
                  const a = answered[m._id];
                  return (
                    <li key={m._id} className="border-b pb-4 last:border-0 last:pb-0">
                      <p className="annotation text-xs">{m.topic}</p>
                      <p className="mt-1 text-sm font-semibold leading-snug">{m.question}</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {m.options.map((opt, i) => {
                          const state = !a
                            ? "idle"
                            : i === m.correctIndex
                              ? "correct"
                              : i === a.choice
                                ? "wrong"
                                : "dim";
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={!!a}
                              onClick={() => void pick(m._id, i)}
                              className={cn(
                                "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                                state === "idle" && "hover:bg-accent",
                                state === "correct" && "border-emerald-500 bg-emerald-500/10 font-semibold",
                                state === "wrong" && "border-rose-500 bg-rose-500/10",
                                state === "dim" && "opacity-50",
                              )}
                            >
                              {state === "correct" && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
                              {state === "wrong" && <XCircle className="size-4 shrink-0 text-rose-600" />}
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {a && m.explanation && (
                        <p className="mt-2 rounded-md bg-paper-deep/60 px-3 py-2 text-sm text-foreground/80">
                          {m.explanation}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Weak topics */}
          {queue.weakTopics.length > 0 && (
            <section className="paper-sheet px-5 py-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
                <Flame className="size-4 text-highlight" /> Topics needing revision
              </h2>
              <ul className="ruled-list mt-2 flex flex-col">
                {queue.weakTopics.map((t) => (
                  <li key={t.topic} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{t.topic}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs font-bold text-destructive">{t.percent}%</span>
                      <Link
                        to="/practice"
                        onClick={sounds.click}
                        className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                      >
                        Practice
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {Object.keys(answered).length > 0 && !finished && (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              {finishing ? <Loader2 className="size-5 animate-spin" /> : <BookOpenCheck className="size-5" />}
              Finish revision
            </button>
          )}
        </>
      )}
    </div>
  );
}

function QueueRow({
  tone,
  label,
  count,
  last,
}: {
  tone: "red" | "orange" | "green";
  label: string;
  count: number;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2",
        !last && "border-b border-dashed",
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold",
          count > 0
            ? tone === "red"
              ? "bg-rose-500/15 text-rose-600"
              : tone === "orange"
                ? "bg-amber-500/15 text-amber-600"
                : "bg-emerald-500/15 text-emerald-600"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </div>
  );
}
