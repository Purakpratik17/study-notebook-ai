import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Crown, Medal, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  userId: string;
  rank: number;
  name: string;
  imageUrl?: string;
  xp: number;
  level: number;
  levelName: string;
  isMe: boolean;
};

const MEDAL_COLOR = ["text-[#d4a017]", "text-[#9aa0a6]", "text-[#a4653b]"];

export default function Leaderboard() {
  const rows = useQuery(api.stats.getLeaderboard);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Trophy className="size-7 text-highlight" /> Leaderboard
        </h1>
        <p className="annotation text-sm">
          top students ranked by total XP — every study session counts
        </p>
        <p className="mt-1 w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
          Climb the ranks. One XP at a time. 🏆
        </p>
      </header>

      {rows === undefined ? (
        <section className="paper-sheet flex items-center gap-3 px-5 py-8">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="annotation text-sm">loading the rankings…</p>
        </section>
      ) : rows.length === 0 ? (
        <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Trophy className="size-8 text-ink-faint" />
          <p className="font-semibold">No rankings yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Earn XP by studying, generating notes and finishing quizzes — then
            claim your spot here.
          </p>
        </section>
      ) : (
        <section className="paper-sheet spiral-edge px-3 py-4 md:px-6">
          <ul className="ruled-list flex flex-col">
            {rows.map((r: Row) => (
              <li key={r.userId}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
                    r.isMe
                      ? "bg-highlight/25 ring-1 ring-highlight/50"
                      : "hover:bg-accent/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex w-8 shrink-0 items-center justify-center font-bold",
                      r.rank <= 3 ? "text-lg" : "text-sm text-ink-soft",
                    )}
                  >
                    {r.rank <= 3 ? (
                      <Medal className={cn("size-5", MEDAL_COLOR[r.rank - 1])} />
                    ) : (
                      r.rank
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        r.isMe ? "font-bold" : "font-semibold",
                      )}
                    >
                      {r.name}
                      {r.isMe && (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          you
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lv {r.level} · {r.levelName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {r.xp.toLocaleString()}{" "}
                    <span className="text-xs font-semibold text-muted-foreground">
                      XP
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 px-3 text-xs text-ink-faint">
            <Sparkles className="size-3" /> Live ranking — updates the moment
            anyone earns XP
          </p>
        </section>
      )}
    </div>
  );
}
