import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Loader2, RefreshCw, Swords, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Quest = {
  _id: string;
  questId: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  xp: number;
  target: number;
  metric: string;
  progress: number;
  status: string;
};

const DIFFICULTY_STYLES: Record<
  Quest["difficulty"],
  { label: string; chip: string; bar: string }
> = {
  easy: {
    label: "Easy",
    chip: "border-xp/40 bg-xp/10 text-xp",
    bar: "bg-xp",
  },
  medium: {
    label: "Medium",
    chip: "border-highlight/60 bg-highlight-soft text-foreground",
    bar: "bg-highlight",
  },
  hard: {
    label: "Hard",
    chip: "border-marker/40 bg-marker-soft text-marker",
    bar: "bg-marker",
  },
};

export default function Quests() {
  const quests = useQuery(api.quests.list) as Quest[] | undefined;
  const completed = useQuery(api.quests.completedCount);
  const refresh = useMutation(api.quests.refresh);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh the rotation on mount; announce quests completed elsewhere.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await refresh({});
        if (cancelled) return;
        for (const q of result.settled ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        }
      } catch {
        // unauthenticated or transient — the page still renders via list()
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh({});
      toast("Quest board refreshed", {
        description: "New challenges appear when the board is empty.",
      });
    } catch {
      toast.error("Could not refresh quests");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Swords className="size-6 text-primary" /> Quests
          </h1>
          <p className="annotation text-sm">today's challenges, fresh daily</p>
        </div>
        <div className="flex items-center gap-3">
          {completed !== undefined && completed.total > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold">
              <Trophy className="size-3.5 text-highlight" />
              {completed.total} completed
            </span>
          )}
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold transition hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      {quests === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="paper-sheet h-36 animate-pulse opacity-70"
            />
          ))}
        </div>
      ) : quests.length === 0 ? (
        <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Swords className="size-8 text-ink-faint" />
          <p className="font-semibold">The quest board is empty</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Study, complete tasks or take a quiz — a fresh set of quests
            appears when this board is cleared.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {quests.map((q) => {
            const style = DIFFICULTY_STYLES[q.difficulty];
            const pct = Math.min(Math.round((q.progress / q.target) * 100), 100);
            const done = q.progress >= q.target;
            return (
              <article
                key={q._id}
                className={cn(
                  "paper-sheet spiral-edge flex flex-col gap-3 px-5 py-4 transition-transform hover:-translate-y-0.5",
                  done && "border-xp/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold leading-snug">
                    {q.title}
                  </h2>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      style.chip,
                    )}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{q.description}</p>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-marker">
                      <Zap className="size-3.5" /> +{q.xp} XP
                    </span>
                    <span className="text-muted-foreground">
                      {Math.min(q.progress, q.target)}/{q.target}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper-deep">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        done ? "bg-xp animate-pop-in" : style.bar,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {done && (
                    <p className="animate-pop-in text-xs font-bold text-xp">
                      ✓ Complete — XP claimed
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
