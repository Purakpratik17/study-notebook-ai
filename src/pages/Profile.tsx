import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  BookOpenCheck,
  CalendarCheck2,
  Flame,
  ListChecks,
  Sigma,
  Star,
  Swords,
  Target,
  Trophy,
} from "lucide-react";

type Stats = {
  xp: number;
  level: number;
  levelName: string;
  nextLevel: number | null;
  nextLevelName: string | null;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpNeeded: number;
  progress: number;
  maxLevel: boolean;
  streak: number;
  bestStreak: number;
  totalTasksCompleted: number;
  totalQuizzesCompleted: number;
  quizAverage: number | null;
};

type LevelDef = { level: number; xp: number; name: string };

export default function Profile() {
  const { name, imageUrl, email } = useAuth();
  const stats = useQuery(api.stats.getStats) as Stats | null | undefined;
  const questsDone = useQuery(api.quests.completedCount);
  const notes = useQuery(api.notes.list);
  const levels = useQuery(api.config.get);

  const levelList: LevelDef[] = levels?.levels ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Identity card */}
      <section className="paper-sheet paper-margin flex flex-col items-center gap-4 px-6 py-6 text-center sm:flex-row sm:text-left md:pl-20">
        <Avatar className="size-20 border-2 border-primary/30 shadow-md">
          <AvatarImage src={imageUrl} alt={name} />
          <AvatarFallback className="bg-highlight-soft text-2xl font-bold">
            {name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="annotation text-sm">student profile</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
          {email && (
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          )}
        </div>
        {stats && (
          <div className="level-chip flex flex-col items-center rounded-xl bg-card px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Level
            </span>
            <span className="text-3xl font-black leading-none text-primary">
              {stats.level}
            </span>
            <span className="mt-1 text-xs font-semibold text-marker">
              {stats.levelName}
            </span>
          </div>
        )}
      </section>

      {stats === undefined ? (
        <div className="paper-sheet h-40 animate-pulse" />
      ) : stats === null ? (
        <p className="text-sm text-muted-foreground">
          Sign in to see your progress.
        </p>
      ) : (
        <>
          {/* XP card */}
          <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Star className="size-4 text-highlight" /> Total XP
                </h2>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {stats.xp.toLocaleString()}{" "}
                  <span className="text-sm font-semibold text-muted-foreground">
                    XP
                  </span>
                </p>
              </div>
              <div className="text-right text-sm">
                {stats.maxLevel ? (
                  <p className="font-semibold text-xp">
                    Max level reached! 🎉
                  </p>
                ) : (
                  <>
                    <p className="font-semibold">
                      {stats.xpNeeded} XP to Level {stats.nextLevel}
                    </p>
                    <p className="annotation text-xs">
                      next: {stats.nextLevelName}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 h-3.5 overflow-hidden rounded-full border border-border/70 bg-paper-deep">
              <div
                className="h-full rounded-full bg-gradient-to-r from-xp/80 to-xp transition-all duration-700"
                style={{ width: `${Math.round(stats.progress * 100)}%` }}
              />
            </div>
            {!stats.maxLevel && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {stats.xpIntoLevel} / {stats.xpForNextLevel} XP into this level
              </p>
            )}
          </section>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Flame className="size-4" />}
              label="Study streak"
              value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
              sub={`best: ${stats.bestStreak}`}
            />
            <StatCard
              icon={<Swords className="size-4" />}
              label="Quests done"
              value={String(questsDone?.total ?? 0)}
              sub="lifetime"
            />
            <StatCard
              icon={<CalendarCheck2 className="size-4" />}
              label="Tasks completed"
              value={String(stats.totalTasksCompleted)}
              sub="timetable"
            />
            <StatCard
              icon={<BookOpenCheck className="size-4" />}
              label="Quizzes taken"
              value={String(stats.totalQuizzesCompleted)}
              sub="AI study"
            />
            <StatCard
              icon={<Sigma className="size-4" />}
              label="Quiz average"
              value={
                stats.quizAverage !== null ? `${stats.quizAverage}%` : "—"
              }
              sub="all attempts"
            />
            <StatCard
              icon={<Target className="size-4" />}
              label="Topics studied"
              value={String(notes?.length ?? 0)}
              sub="saved notes"
            />
          </div>

          {/* Level ladder */}
          {levelList.length > 0 && (
            <section className="paper-sheet px-5 py-5 md:px-7">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Level ladder
              </h2>
              <ul className="ruled-list mt-2 flex flex-col">
                {levelList.map((l) => {
                  const reached = stats.xp >= l.xp;
                  const isCurrent = stats.level === l.level;
                  return (
                    <li
                      key={l.level}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                          isCurrent
                            ? "border-primary bg-primary text-primary-foreground"
                            : reached
                              ? "border-xp/60 bg-xp/10 text-xp"
                              : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {l.level}
                      </span>
                      <span
                        className={cn(
                          "flex-1 font-semibold",
                          !reached && "text-muted-foreground",
                        )}
                      >
                        {l.name}
                        {isCurrent && (
                          <span className="annotation ml-2 text-xs">
                            ← you are here
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.xp} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Recent quest completions summary */}
          <section className="flex flex-wrap gap-3">
            <SummaryChip
              icon={<ListChecks className="size-3.5" />}
              text={`${stats.totalTasksCompleted} tasks checked off`}
            />
            <SummaryChip
              icon={<Trophy className="size-3.5" />}
              text={`${questsDone?.total ?? 0} quests conquered`}
            />
            <SummaryChip
              icon={<Flame className="size-3.5" />}
              text={`${stats.bestStreak}-day best streak`}
            />
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="paper-sheet spiral-edge flex flex-col gap-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-black leading-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function SummaryChip({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80">
      <span className="text-marker">{icon}</span>
      {text}
    </span>
  );
}
