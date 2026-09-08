import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock,
  Flame,
  Loader2,
  NotebookPen,
  Sparkles,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

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
};

type Summary = {
  today: string;
  tasksTotal: number;
  tasksCompleted: number;
  plannedMinutes: number;
  doneMinutes: number;
  studiedMinutesToday: number;
  dailyGoalMinutes: number;
  completionPercent: number;
  dailyGoalBonusReady: boolean;
  activeQuests: Array<{
    _id: string;
    title: string;
    description: string;
    difficulty: string;
    xp: number;
    progress: number;
    target: number;
  }>;
  studiedToday: boolean;
};

type Entry = {
  _id: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  completed: boolean;
};

type XpEvent = {
  _id: string;
  amount: number;
  reason: string;
  createdAt: number;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { name } = useAuth();
  const stats = useQuery(api.stats.getStats) as Stats | null | undefined;
  const summary = useQuery(api.stats.getDashboardSummary) as
    | Summary
    | undefined;
  const todaysTasks = useQuery(api.timetable.list) as Entry[] | undefined;
  const recent = useQuery(api.stats.getRecentActivity) as
    | XpEvent[]
    | undefined;
  const logSession = useMutation(api.notes.logStudySession);
  const claimGoal = useMutation(api.notes.claimDailyGoal);
  const toggle = useMutation(api.timetable.toggleComplete);

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = (todaysTasks ?? []).filter((t) => t.date === today);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleLogSession = async () => {
    if (logging) return;
    setLogging(true);
    try {
      const r = await logSession({ minutes: 30 });
      if (r.xp.granted) {
        toast.success(`+${r.xp.amount} XP — studied 30 minutes`);
        for (const q of r.settledQuests ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        }
      } else {
        toast("Session already logged recently", {
          description: "Keep going — next hour brings more XP.",
        });
      }
    } catch {
      toast.error("Could not log the session");
    } finally {
      setLogging(false);
    }
  };

  const handleClaimGoal = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const r = await claimGoal({});
      if (r.xp.granted) {
        toast.success(`+${r.xp.amount} XP — daily study goal reached!`);
      } else {
        toast("Daily goal bonus already claimed today");
      }
    } catch {
      toast.error("Could not claim the bonus");
    } finally {
      setClaiming(false);
    }
  };

  const handleToggleTask = async (t: Entry) => {
    if (pendingTask) return;
    setPendingTask(t._id);
    try {
      const r = await toggle({ entryId: t._id as never });
      if (r.completed) {
        if (r.xp?.granted) toast.success(`+${r.xp.amount} XP — task completed`);
        for (const q of r.settledQuests ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        }
      }
    } catch {
      toast.error("Could not update the task");
    } finally {
      setPendingTask(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: greeting + level */}
      <section className="paper-sheet paper-margin px-5 py-5 pl-14 md:px-8 md:pl-20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="annotation text-sm">{greeting().toLowerCase()},</p>
            <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
              {name}!
            </h1>
            {summary && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Flame
                  className={cn(
                    "size-4",
                    summary.studiedToday ? "text-marker" : "text-ink-faint",
                  )}
                />
                {summary.studiedToday
                  ? `${stats?.streak ?? 1}-day streak — keep it burning`
                  : "No study XP yet today — let's fix that"}
              </p>
            )}
          </div>

          {stats && (
            <div className="w-full max-w-xs">
              <div className="flex items-end justify-between">
                <span className="level-chip rounded-lg bg-card px-2.5 py-1 text-xs font-bold text-primary">
                  Lv {stats.level} · {stats.levelName}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {stats.maxLevel
                    ? "Max level"
                    : `${stats.xpNeeded} XP to Lv ${stats.nextLevel}`}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full border border-border/70 bg-paper-deep">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-xp/80 to-xp transition-all duration-700"
                  style={{ width: `${Math.round(stats.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {stats.xp.toLocaleString()} XP total
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/ai-study"
          className="paper-sheet spiral-edge group flex items-center gap-4 px-5 py-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-bold">AI Study</span>
            <span className="block text-sm text-muted-foreground">
              Notes + quiz on any topic
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        <button
          onClick={handleLogSession}
          disabled={logging}
          className="paper-sheet spiral-edge group flex items-center gap-4 px-5 py-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-xp text-white shadow-sm">
            {logging ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Zap className="size-5" />
            )}
          </span>
          <span className="flex-1">
            <span className="block font-bold">Log a study session</span>
            <span className="block text-sm text-muted-foreground">
              30 focused minutes · +XP
            </span>
          </span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's timetable */}
        <section className="paper-sheet paper-margin px-5 py-5 pl-14 md:pl-18">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <CalendarCheck2 className="size-4" /> Today's timetable
            </h2>
            {summary && summary.tasksTotal > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                {summary.tasksCompleted}/{summary.tasksTotal} done
              </span>
            )}
          </div>

          {todayTasks === undefined ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {[80, 65].map((w, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="py-6 text-center">
              <NotebookPen className="mx-auto size-7 text-ink-faint" />
              <p className="mt-2 text-sm font-semibold">
                Nothing scheduled today
              </p>
              <p className="mx-auto mt-1 max-w-[240px] text-xs text-muted-foreground">
                Plan your day in the timetable to earn task XP.
              </p>
              <Link
                to="/timetable"
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-semibold transition hover:bg-accent"
              >
                Open timetable <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="ruled-list mt-2 flex flex-col">
              {todayTasks.slice(0, 5).map((t) => (
                <li key={t._id} className="flex items-center gap-2.5 py-2">
                  <button
                    role="checkbox"
                    aria-checked={t.completed}
                    aria-label={`Mark ${t.subject} ${t.completed ? "incomplete" : "complete"}`}
                    disabled={pendingTask === t._id}
                    onClick={() => handleToggleTask(t)}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border-2 transition",
                      t.completed
                        ? "border-xp bg-xp text-white"
                        : "border-ink-faint/60 bg-card hover:border-xp",
                    )}
                  >
                    {pendingTask === t._id ? (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    ) : (
                      t.completed && <Check className="size-3.5" strokeWidth={3} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        t.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {t.subject}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" /> {t.startTime}
                  </span>
                </li>
              ))}
              {todayTasks.length > 5 && (
                <li className="pt-1.5 text-center">
                  <Link
                    to="/timetable"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    +{todayTasks.length - 5} more — view all
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Daily progress */}
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <Target className="size-4" /> Today's progress
          </h2>

          {summary === undefined ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black leading-none">
                    {summary.completionPercent}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    of today's tasks
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${summary.completionPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-card/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Minutes studied
                  </p>
                  <p className="text-lg font-bold">
                    {Math.max(summary.doneMinutes, summary.studiedMinutesToday)}
                    <span className="text-xs font-medium text-muted-foreground">
                      {" "}/ {Math.max(summary.plannedMinutes, summary.dailyGoalMinutes)}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border bg-card/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Streak</p>
                  <p className="flex items-center gap-1 text-lg font-bold">
                    <Flame className="size-4 text-marker" />
                    {stats?.streak ?? 0}
                  </p>
                </div>
              </div>

              {summary.dailyGoalBonusReady ? (
                <button
                  onClick={handleClaimGoal}
                  disabled={claiming}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-highlight px-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-highlight/80 disabled:opacity-60"
                >
                  {claiming && <Loader2 className="size-4 animate-spin" />}
                  🎉 Claim daily goal bonus
                </button>
              ) : (
                <p className="annotation text-xs">
                  reach {summary.dailyGoalMinutes} min to unlock the daily bonus
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active quests */}
        <section className="paper-sheet px-5 py-5 md:px-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <Swords className="size-4" /> Active quests
            </h2>
            <Link
              to="/quests"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {summary === undefined ? (
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : summary.activeQuests.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              No active quests right now.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {summary.activeQuests.map((q) => {
                const pct = Math.min(
                  Math.round((q.progress / q.target) * 100),
                  100,
                );
                return (
                  <li key={q._id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{q.title}</span>
                      <span className="shrink-0 text-xs font-bold text-marker">
                        +{q.xp} XP
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className="h-full rounded-full bg-marker transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Recent study activity
          </h2>
          {recent === undefined ? (
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              No activity yet — generate your first notes or complete a task!
            </p>
          ) : (
            <ul className="ruled-list mt-2 flex flex-col">
              {recent.slice(0, 6).map((e) => (
                <li key={e._id} className="flex items-center gap-2 py-2 text-sm">
                  <Zap className="size-3.5 shrink-0 text-xp" />
                  <span className="min-w-0 flex-1 truncate">{e.reason}</span>
                  <span className="shrink-0 text-xs font-bold text-xp">
                    +{e.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
