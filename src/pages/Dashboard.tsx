import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock,
  FileStack,
  Flame,
  Gamepad2,
  Loader2,
  NotebookPen,
  Pause,
  PenLine,
  Play,
  Sparkles,
  StopCircle,
  Swords,
  Target,
  Timer,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";

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
  bestStreak?: number;
  totalMinutesStudied?: number;
  minutesStudiedToday?: number;
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
    metric: string;
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

const FOCUS_EGG_MINUTES = 240;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtHm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
  const { name } = useAuth();
  const sounds = useSounds();
  const stats = useQuery(api.stats.getStats) as Stats | null | undefined;
  const summary = useQuery(api.stats.getDashboardSummary) as
    | Summary
    | undefined;
  const insights = useQuery(api.progress.insights) as
    | {
        quizAccuracy: number | null;
        practiceAccuracy: number | null;
        completedTopics: number;
        weakTopics: Array<{ topic: string; percent: number }>;
        strongTopics: Array<{ topic: string; percent: number }>;
      }
    | undefined;
  const positions = useQuery(api.progress.positions) as
    | Array<{ _id: string; subject: string; chapter: string; topic: string }>
    | undefined;
  const todaysTasks = useQuery(api.timetable.list) as Entry[] | undefined;
  const recent = useQuery(api.stats.getRecentActivity) as XpEvent[] | undefined;
  const notes = useQuery(api.notes.list) as
    | Array<{ _id: string; topic: string; quizCount: number; createdAt: number }>
    | undefined;
  const arcadeUnlocked = useQuery(api.profiles.hasArcade);
  const logSession = useMutation(api.notes.logStudySession);
  const claimGoal = useMutation(api.notes.claimDailyGoal);
  const toggle = useMutation(api.timetable.toggleComplete);
  const recordFocus = useMutation(api.profiles.recordFocusSession);

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = (todaysTasks ?? []).filter((t) => t.date === today);
  const upcoming = todayTasks.filter((t) => !t.completed).slice(0, 4);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // ── Focus session timer (real tracked time → 4h easter egg) ──────────────
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusRunning) return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setFocusSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    const onVisibility = () => {
      // Page hidden — pause so time is only counted while actually focused here.
      if (document.hidden) setFocusRunning(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [focusRunning]);

  const startFocus = () => {
    startedAtRef.current = Date.now() - focusSeconds * 1000;
    setFocusRunning(true);
  };
  const pauseFocus = () => setFocusRunning(false);
  const stopFocus = async () => {
    setFocusRunning(false);
    const minutes = Math.floor(focusSeconds / 60);
    if (minutes < 1) {
      setFocusSeconds(0);
      startedAtRef.current = null;
      return;
    }
    const unlocked = await recordFocus({
      sessionId: crypto.randomUUID(),
      minutes,
    });
    if (unlocked.eggUnlocked) {
      toast.success("🎮 Secret unlocked! Check the Arcade…", {
        description: "4 hours of pure focus deserves a reward.",
        duration: 8000,
      });
      sounds.unlock();
    } else if (unlocked.newlyUnlocked.length > 0) {
      toast.success("🏆 New achievement unlocked!");
      sounds.unlock();
    }
    toast.success(`+${unlocked.xp.amount} XP — ${fmtHm(minutes)} focused`);
    sounds.xp();
    setFocusSeconds(0);
    startedAtRef.current = null;
  };

  const focusMinutes = Math.floor(focusSeconds / 60);
  const focusPct = Math.min((focusSeconds / (FOCUS_EGG_MINUTES * 60)) * 100, 100);

  // ── Existing handlers (preserved) ────────────────────────────────────────
  const handleLogSession = async () => {
    if (logging) return;
    setLogging(true);
    try {
      const r = await logSession({ minutes: 30 });
      if (r.xp.granted) {
        toast.success(`+${r.xp.amount} XP — studied 30 minutes`);
        sounds.xp();
        for (const q of r.settledQuests ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
          sounds.success();
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
        sounds.xp();
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
        if (r.xp?.granted) {
          toast.success(`+${r.xp.amount} XP — task completed`);
          sounds.xp();
        }
        for (const q of r.settledQuests ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
          sounds.success();
        }
        if (r.xp?.granted || (r.settledQuests?.length ?? 0) > 0) sounds.success();
      }
    } catch {
      toast.error("Could not update the task");
    } finally {
      setPendingTask(null);
    }
  };

  const xpToday = summary?.studiedMinutesToday ?? 0;
  const todayMinutes = Math.max(
    summary?.doneMinutes ?? 0,
    summary?.studiedMinutesToday ?? 0,
  );

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

      {/* Stat widgets */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          icon={<Zap className="size-4" />}
          label="Study time today"
          value={fmtHm(todayMinutes)}
          sub={`goal ${summary?.dailyGoalMinutes ?? 60}m`}
        />
        <MiniStat
          icon={<Flame className="size-4" />}
          label="Streak"
          value={`${stats?.streak ?? 0}d`}
          sub={`best ${stats?.bestStreak ?? 0}d`}
        />
        <MiniStat
          icon={<Check className="size-4" />}
          label="Tasks today"
          value={`${summary?.tasksCompleted ?? 0}/${summary?.tasksTotal ?? 0}`}
          sub={`${summary?.completionPercent ?? 0}% done`}
        />
        <MiniStat
          icon={<Trophy className="size-4" />}
          label="Total XP"
          value={(stats?.xp ?? 0).toLocaleString()}
          sub={stats ? `Lv ${stats.level} ${stats.levelName}` : ""}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          to="/ai-study"
          className="paper-sheet spiral-edge group flex flex-col gap-2 px-4 py-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <span className="block font-bold">AI Study</span>
          <span className="block text-xs text-muted-foreground">
            Notes + quiz on any topic
          </span>
        </Link>

        <Link
          to="/essay"
          className="paper-sheet group flex flex-col gap-2 px-4 py-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-marker text-white shadow-sm">
            <PenLine className="size-5" />
          </span>
          <span className="block font-bold">Essay Writer</span>
          <span className="block text-xs text-muted-foreground">
            Structured essays, instantly
          </span>
        </Link>

        <Link
          to="/projects"
          className="paper-sheet group flex flex-col gap-2 px-4 py-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-highlight text-foreground shadow-sm">
            <FileStack className="size-5" />
          </span>
          <span className="block font-bold">Project Creator</span>
          <span className="block text-xs text-muted-foreground">
            Full assignment projects
          </span>
        </Link>

        {arcadeUnlocked ? (
          <Link
            to="/arcade"
            className="paper-sheet group flex flex-col gap-2 px-4 py-4 transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-xp text-white shadow-sm">
              <Gamepad2 className="size-5" />
            </span>
            <span className="block font-bold">Arcade</span>
            <span className="block text-xs text-muted-foreground">
              Your focus reward 🎮
            </span>
          </Link>
        ) : (
          <Link
            to="/leaderboard"
            className="paper-sheet group flex flex-col gap-2 px-4 py-4 transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-xp text-white shadow-sm">
              <Trophy className="size-5" />
            </span>
            <span className="block font-bold">Leaderboard</span>
            <span className="block text-xs text-muted-foreground">
              Climb the ranks
            </span>
          </Link>
        )}
      </div>

      {/* Focus timer + log session */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <Timer className="size-4" /> Focus session
          </h2>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums leading-none">
              {String(Math.floor(focusSeconds / 3600)).padStart(2, "0")}:
              {String(Math.floor((focusSeconds % 3600) / 60)).padStart(2, "0")}:
              {String(focusSeconds % 60).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground">
              tracked while this tab stays open
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-1000"
              style={{ width: `${focusPct}%` }}
            />
          </div>
          <p className="annotation mt-2 text-xs">
            hit {fmtHm(FOCUS_EGG_MINUTES)} in one session and something fun
            unlocks…
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!focusRunning ? (
              <button
                onClick={startFocus}
                disabled={focusSeconds === 0 && false}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
              >
                <Play className="size-4" />
                {focusSeconds > 0 ? "Resume" : "Start focus"}
              </button>
            ) : (
              <button
                onClick={pauseFocus}
                className="inline-flex h-11 items-center gap-2 rounded-lg border bg-card px-5 text-sm font-bold transition hover:bg-accent active:scale-[0.98]"
              >
                <Pause className="size-4" /> Pause
              </button>
            )}
            {focusSeconds > 0 && (
              <button
                onClick={stopFocus}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-xp px-5 text-sm font-bold text-white shadow-sm transition hover:bg-xp/90 active:scale-[0.98]"
              >
                <StopCircle className="size-4" /> Finish & bank{" "}
                {fmtHm(Math.max(focusMinutes, 0))}
              </button>
            )}
          </div>
        </section>

        <section className="paper-sheet px-5 py-5 md:px-7">
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

              <button
                onClick={handleLogSession}
                disabled={logging}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-bold transition hover:bg-accent disabled:opacity-60"
              >
                {logging ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4 text-xp" />
                )}
                Log a 30-min study session
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming timetable */}
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
          ) : upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-xp">
              All done for today — brilliant! ✨
            </p>
          ) : (
            <ul className="ruled-list mt-2 flex flex-col">
              {upcoming.map((t) => (
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
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" /> {t.startTime}
                  </span>
                </li>
              ))}
              {todayTasks.length > 4 && (
                <li className="pt-1.5 text-center">
                  <Link
                    to="/timetable"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View all {todayTasks.length} tasks
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

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
        {/* Progress insights */}
        <section className="paper-sheet px-5 py-5 md:px-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <Target className="size-4" /> Progress insights
            </h2>
            <Link
              to="/profile"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Full stats
            </Link>
          </div>
          {insights === undefined ? (
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Quiz accuracy", value: insights.quizAccuracy },
                  { label: "Practice accuracy", value: insights.practiceAccuracy },
                  { label: "Topics practiced", value: insights.completedTopics },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex flex-col items-center rounded-lg border bg-paper-deep/50 px-2 py-3 text-center"
                  >
                    <span className="text-xl font-extrabold text-primary">
                      {m.value === null ? "–" : m.value}
                      {typeof m.value === "number" && m.value <= 100 ? "%" : ""}
                    </span>
                    <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
              {(insights.weakTopics.length > 0 || insights.strongTopics.length > 0) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {insights.weakTopics.length > 0 && (
                    <div>
                      <p className="annotation text-xs">needs a little more love</p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {insights.weakTopics.map((t) => (
                          <li key={t.topic} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{t.topic}</span>
                            <span className="shrink-0 text-xs font-bold text-destructive">{t.percent}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.strongTopics.length > 0 && (
                    <div>
                      <p className="annotation text-xs">your strong suits</p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {insights.strongTopics.map((t) => (
                          <li key={t.topic} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{t.topic}</span>
                            <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400">{t.percent}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {positions !== undefined && positions.length > 0 && (
                <div className="mt-4">
                  <p className="annotation text-xs">continue where you left off</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {positions.slice(0, 4).map((p) => (
                      <Link
                        key={p._id}
                        to="/practice"
                        onClick={sounds.click}
                        className="rounded-full border bg-highlight-soft/50 px-3 py-1.5 text-xs font-semibold transition hover:bg-highlight/60"
                      >
                        {p.subject} · {p.topic}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent notes */}
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <NotebookPen className="size-4" /> Recent notes
            </h2>
            <Link
              to="/ai-study"
              className="text-xs font-semibold text-primary hover:underline"
            >
              New notes
            </Link>
          </div>
          {notes === undefined ? (
            <div className="mt-3 flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              No notes yet — generate your first study pack!
            </p>
          ) : (
            <ul className="ruled-list mt-2 flex flex-col">
              {notes.slice(0, 5).map((n) => (
                <li key={n._id} className="flex items-center gap-2 py-2 text-sm">
                  <NotebookPen className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {n.topic}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {n.quizCount} questions
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              <Zap className="size-4" /> Recent activity
            </h2>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <User className="size-3" /> Profile
            </Link>
          </div>
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

      {xpToday === 0 && (
        <p className="annotation text-center text-sm">
          Small progress is still progress. Start with one task. ✨
        </p>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="paper-sheet spiral-edge flex flex-col gap-0.5 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-xl font-black leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}
