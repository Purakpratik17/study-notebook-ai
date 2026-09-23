import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/loading";

/* ═══════════════════════════════════════════════════════════════════════
   Weekly Report — "Your Week in Review".

   All numbers come from the existing Convex data (xpEvents, practice,
   quizzes, notes, timetable, stats streaks). Nothing is invented:
   a metric with no data shows 0, "—", or a friendly empty state.

   Week = Monday → Sunday (local time), matching the backend.
   ═══════════════════════════════════════════════════════════════════════ */

type Report = NonNullable<ReturnType<typeof useQuery<typeof api.weekly.getWeeklyReport>>>;

/** Neutral, motivational summary built deterministically from real stats. */
function summary(r: Report): string {
  if (r.xpEarned === 0 && r.studyDays === 0) {
    return "No activity this week yet — generate some notes or complete a task to start your report!";
  }
  const parts: string[] = [];
  if (r.studyDays > 0) {
    parts.push(
      r.studyDays === 7
        ? "You studied every single day"
        : `You studied on ${r.studyDays} of 7 days`,
    );
  }
  if (r.xpEarned > 0) parts.push(`earned ${r.xpEarned.toLocaleString()} XP`);
  if (r.accuracy !== null) parts.push(`your practice accuracy was ${r.accuracy}%`);
  let out = parts.join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
  if (r.compare.xp !== null && r.compare.xp > 0) {
    out += " You're building momentum!";
  } else if (r.studyDays >= 5) {
    out += " Great consistency this week!";
  } else {
    out += " Keep going!";
  }
  return out;
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        flat ? "text-muted-foreground" : up ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      )}
    >
      {flat ? "· same as last week" : `${up ? "↑" : "↓"} ${Math.abs(value)}${suffix} ${up ? "from" : "vs"} last week`}
    </span>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-tight tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function WeeklyReport() {
  const [weekOffset, setWeekOffset] = useState(0);
  const report = useQuery(api.weekly.getWeeklyReport, { weekOffset });

  if (report === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Shimmer className="h-9 w-44" />
          <Shimmer className="h-8 w-24" />
        </div>
        <Shimmer className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Shimmer className="h-16 rounded-xl" />
          <Shimmer className="h-16 rounded-xl" />
        </div>
      </div>
    );
  }
  if (report === null) return null; // unauthenticated — RequireAuth guards this

  const maxDayXp = Math.max(1, ...report.perDay.map((d) => d.xp));
  const canGoForward = weekOffset < 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-10">
      {/* Header + week navigation */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Weekly Report</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            disabled={!canGoForward}
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Report card */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-5 p-5">
          <div className="text-center">
            <p className="annotation text-xs uppercase tracking-widest">Your Week in Review</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{report.rangeLabel}</p>
            <p className="mt-3 text-4xl font-extrabold tabular-nums tracking-tight text-primary">
              {report.xpEarned.toLocaleString()}{" "}
              <span className="text-base font-semibold text-muted-foreground">XP</span>
            </p>
            <p className="text-xs text-muted-foreground">earned this week</p>
            <div className="mt-1 flex justify-center">
              <Delta value={report.compare.xp} suffix=" XP" />
            </div>
          </div>

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile icon={BookOpen} value={String(report.sessions)} label="Study sessions" />
            <StatTile
              icon={Target}
              value={report.accuracy !== null ? `${report.accuracy}%` : "—"}
              label="Accuracy"
            />
            <StatTile icon={Brain} value={String(report.topicsCount)} label="Topics" />
            <StatTile icon={Flame} value={String(report.studyDays)} label="Study days" />
          </div>
          <div className="flex justify-center">
            <Delta value={report.compare.accuracy} suffix="%" />
          </div>

          {/* Mon–Sun activity chart */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activity
            </p>
            <div className="flex h-24 items-end justify-between gap-1.5">
              {report.perDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all",
                        d.xp > 0 ? "bg-primary/80" : "bg-border/60",
                      )}
                      style={{ height: `${d.xp > 0 ? Math.max(12, (d.xp / maxDayXp) * 100) : 6}%` }}
                      title={d.xp > 0 ? `${d.xp} XP` : "No activity"}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      d.xp > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance detail */}
      <Card>
        <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{report.questions}</p>
            <p className="text-[11px] text-muted-foreground">Questions</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {report.correct}
            </p>
            <p className="text-[11px] text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-muted-foreground">{report.incorrect}</p>
            <p className="text-[11px] text-muted-foreground">To review</p>
          </div>
        </CardContent>
      </Card>

      {/* More activity */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={Sparkles} value={String(report.notesGenerated)} label="Notes generated" />
        <StatTile icon={Target} value={String(report.practiceCompleted)} label="Practice sets" />
        <StatTile icon={Brain} value={String(report.quizzesCompleted)} label="Quizzes" />
        <StatTile icon={Trophy} value={`#${report.rank}`} label="Global rank" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          icon={BookOpen}
          value={report.minutesStudied > 0 ? `${Math.round(report.minutesStudied / 60)}h` : "0m"}
          label="Planned time done"
        />
        <StatTile icon={Flame} value={String(report.streak)} label="Current streak" />
      </div>

      {/* Highlights — only shown when there is real data */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-bold">Your Highlights</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Most studied topic</span>
              <span className="truncate font-medium">
                {report.topTopic ?? <span className="text-muted-foreground">No activity yet</span>}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Best accuracy</span>
              <span className="font-medium">
                {report.accuracy !== null ? `${report.accuracy}%` : "No quizzes yet"}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Most productive day</span>
              <span className="font-medium">
                {report.bestDay ? `${report.bestDay.label} (${report.bestDay.xp} XP)` : "No activity yet"}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">XP earned</span>
              <span className="font-medium tabular-nums">{report.xpEarned.toLocaleString()}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Deterministic motivational summary */}
      <p className="rounded-xl border bg-primary/5 p-4 text-sm leading-relaxed">
        {summary(report)}
      </p>
    </div>
  );
}
