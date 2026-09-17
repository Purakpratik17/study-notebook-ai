import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Eraser,
  Frown,
  Loader2,
  Meh,
  Plus,
  Smile,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";

type Card = {
  _id: string;
  topic: string;
  subject?: string;
  front: string;
  back: string;
  intervalDays: number;
  nextDue: number;
  reviews: number;
  lapses: number;
  source: "manual" | "ai";
};

type DueData = {
  dueNow: Card[];
  upcoming: Card[];
  total: number;
  learned: number;
  needsWork: number;
};

const RATING_BUTTONS = [
  { key: "again", label: "Again", icon: Frown, className: "bg-rose-500/90 hover:bg-rose-500" },
  { key: "hard", label: "Hard", icon: Meh, className: "bg-amber-500/90 hover:bg-amber-500" },
  { key: "good", label: "Good", icon: Smile, className: "bg-emerald-600/90 hover:bg-emerald-600" },
  { key: "easy", label: "Easy", icon: Zap, className: "bg-primary hover:bg-primary/90" },
] as const;

export default function Flashcards() {
  const sounds = useSounds();
  const dueData = useQuery(api.flashcards.due) as DueData | undefined;
  const topics = useQuery(api.flashcards.topics) as
    | Array<{ topic: string; count: number }>
    | undefined;
  const notesList = useQuery(api.notes.list) as
    | Array<{ _id: string; topic: string }>
    | undefined;

  const createCard = useMutation(api.flashcards.create);
  const removeCard = useMutation(api.flashcards.remove);
  const reviewCard = useMutation(api.flashcards.review);
  const completeReviews = useMutation(api.flashcards.completeReviewSession);
  const generateCards = useAction(api.flashcards.generateFromNote);

  const [mode, setMode] = useState<"browse" | "review" | "add">("browse");
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // add-form state
  const [fTopic, setFTopic] = useState("");
  const [fFront, setFFront] = useState("");
  const [fBack, setFBack] = useState("");
  const [genNoteId, setGenNoteId] = useState<string>("");
  const [genError, setGenError] = useState<string | null>(null);

  const startReview = (cards: Card[]) => {
    if (cards.length === 0) return;
    sounds.click();
    setReviewQueue(cards);
    setFlipped(false);
    setReviewedCount(0);
    setSessionDone(false);
    setMode("review");
  };

  const rate = async (rating: "again" | "hard" | "good" | "easy") => {
    const card = reviewQueue[0];
    if (!card) return;
    try {
      await reviewCard({ cardId: card._id as never, rating });
      if (rating === "again") sounds.incorrect();
      else if (rating === "easy") sounds.unlock();
      else sounds.correct();
      const next = reviewedCount + 1;
      setReviewedCount(next);
      setFlipped(false);
      // "Again" pushes the card to the back of the queue for this session.
      if (rating === "again" && reviewQueue.length > 1) {
        setReviewQueue((q) => [...q.slice(1), card]);
      } else {
        setReviewQueue((q) => q.slice(1));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save review.");
    }
  };

  // End of queue → award session XP once.
  if (mode === "review" && reviewQueue.length === 0 && !sessionDone && reviewedCount > 0) {
    setSessionDone(true);
    void completeReviews({ reviewed: reviewedCount })
      .then((r) => {
        if (r.xp.granted) toast.success(`+${r.xp.amount} XP — review session done!`);
        for (const q of r.settledQuests) toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        sounds.complete();
      })
      .catch(() => toast.error("Could not save review session XP."));
  }

  const addManual = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createCard({ topic: fTopic, front: fFront, back: fBack });
      toast.success("Card created!");
      sounds.success();
      setFFront("");
      setFBack("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create card.");
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!genNoteId || busy) return;
    setBusy(true);
    setGenError(null);
    try {
      const r = await generateCards({ noteId: genNoteId as never });
      toast.success(`Created ${r.created} flashcards!`);
      sounds.unlock();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const cards =
    dueData === undefined
      ? undefined
      : filterTopic
        ? [...dueData.dueNow, ...dueData.upcoming].filter((c) => c.topic === filterTopic)
        : [...dueData.dueNow, ...dueData.upcoming];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">🗂️ Flashcards</h1>
        <p className="annotation text-sm">
          tap to flip · rate how well you knew it · we schedule the rest
        </p>
      </header>

      {mode === "review" ? (
        <ReviewSession
          queue={reviewQueue}
          flipped={flipped}
          onFlip={() => {
            sounds.click();
            setFlipped(true);
          }}
          onRate={(r) => void rate(r)}
          done={sessionDone}
          reviewed={reviewedCount}
          onExit={() => {
            sounds.click();
            setMode("browse");
          }}
        />
      ) : (
        <>
          {/* Stats strip */}
          {dueData !== undefined && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Due now", value: dueData.dueNow.length },
                { label: "Total cards", value: dueData.total },
                { label: "Learned", value: dueData.learned },
                { label: "Needs work", value: dueData.needsWork },
              ].map((s) => (
                <div
                  key={s.label}
                  className="paper-sheet flex flex-col items-center gap-0.5 px-3 py-3 text-center"
                >
                  <span className="text-2xl font-extrabold text-primary">{s.value}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Review CTA */}
          {dueData !== undefined && dueData.dueNow.length > 0 && (
            <button
              type="button"
              onClick={() => startReview(dueData.dueNow)}
              className="rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
            >
              Start review — {dueData.dueNow.length} card
              {dueData.dueNow.length === 1 ? "" : "s"} due
            </button>
          )}

          {/* Tabs: browse / add */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.click();
                setMode("browse");
              }}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition",
                mode === "browse" ? "bg-primary text-primary-foreground border-primary" : "bg-background",
              )}
            >
              My cards
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.click();
                setMode("add");
              }}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-bold transition",
                mode === "add" ? "bg-primary text-primary-foreground border-primary" : "bg-background",
              )}
            >
              <Plus className="inline size-4" /> Add cards
            </button>
          </div>

          {mode === "add" && (
            <section className="paper-sheet px-5 py-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Generate from a note
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  value={genNoteId}
                  onChange={(e) => setGenNoteId(e.target.value)}
                  className="h-12 flex-1 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Choose a saved topic…</option>
                  {(notesList ?? []).map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.topic}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void runGenerate()}
                  disabled={!genNoteId || busy}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Generate 8 cards
                </button>
              </div>
              {genError && (
                <p className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="size-4" /> {genError}
                </p>
              )}

              <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink-soft">
                Or write your own
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={fTopic}
                  onChange={(e) => setFTopic(e.target.value)}
                  placeholder="Topic (e.g. Photosynthesis)"
                  className="h-12 rounded-lg border bg-background px-3 text-sm"
                  maxLength={120}
                />
                <textarea
                  value={fFront}
                  onChange={(e) => setFFront(e.target.value)}
                  placeholder="Front — the question or term"
                  className="min-h-16 rounded-lg border bg-background px-3 py-2 text-sm"
                  maxLength={200}
                />
                <textarea
                  value={fBack}
                  onChange={(e) => setFBack(e.target.value)}
                  placeholder="Back — the answer"
                  className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm"
                  maxLength={500}
                />
                <button
                  type="button"
                  onClick={() => void addManual()}
                  disabled={busy || !fFront.trim() || !fBack.trim()}
                  className="h-12 rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  Create card
                </button>
              </div>
            </section>
          )}

          {/* Topic filter chips */}
          {topics !== undefined && topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.click();
                  setFilterTopic(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  filterTopic === null ? "bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                All
              </button>
              {topics.map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setFilterTopic(t.topic);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    filterTopic === t.topic ? "bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {t.topic} ({t.count})
                </button>
              ))}
            </div>
          )}

          {/* Card list */}
          {cards === undefined ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="text-4xl">🗂️</span>
              <p className="font-semibold">No flashcards yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create your first flashcard — or generate a deck from any saved note.
              </p>
              <button
                type="button"
                onClick={() => {
                  sounds.click();
                  setMode("add");
                }}
                className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Plus className="inline size-4" /> Create your first flashcard
              </button>
            </section>
          ) : (
            <ul className="flex flex-col gap-3">
              {cards.map((c) => (
                <li key={c._id} className="paper-sheet px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{c.front}</p>
                      <p className="annotation mt-1 text-xs">
                        {c.topic} · {c.reviews} review{c.reviews === 1 ? "" : "s"}
                        {c.intervalDays >= 7 ? " · learned ✓" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void removeCard({ id: c._id as never });
                        sounds.click();
                      }}
                      aria-label="Delete card"
                      className="shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Eraser className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Review session: one card at a time, flip, rate ─────────────────────── */

function ReviewSession({
  queue,
  flipped,
  onFlip,
  onRate,
  done,
  reviewed,
  onExit,
}: {
  queue: Card[];
  flipped: boolean;
  onFlip: () => void;
  onRate: (r: "again" | "hard" | "good" | "easy") => void;
  done: boolean;
  reviewed: number;
  onExit: () => void;
}) {
  if (done || queue.length === 0) {
    return (
      <section className="paper-sheet flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold">Review complete!</p>
        <p className="text-sm text-muted-foreground">
          You reviewed {reviewed} card{reviewed === 1 ? "" : "s"}. Cards you marked
          “Again” will come back soon.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Back to my cards
        </button>
      </section>
    );
  }

  const card = queue[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="annotation">
          card {queue.length <= 1 ? reviewed + 1 : `${reviewed + 1} · ${queue.length} left`}
        </span>
        <button type="button" onClick={onExit} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          End session
        </button>
      </div>

      <button
        type="button"
        onClick={onFlip}
        className="paper-sheet flex min-h-64 w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center active:scale-[0.99]"
      >
        <p className="annotation text-xs">{card.topic}{flipped ? " · answer" : " · question"}</p>
        <p className="max-w-md text-lg font-semibold leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        {!flipped && <p className="annotation mt-2 text-xs">tap to reveal</p>}
      </button>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATING_BUTTONS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => onRate(b.key)}
              className={cn(
                "flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-sm transition active:scale-[0.97]",
                b.className,
              )}
            >
              <b.icon className="size-4" /> {b.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="annotation text-center text-xs">
          answer out loud, then flip and be honest with yourself
        </p>
      )}
    </div>
  );
}
