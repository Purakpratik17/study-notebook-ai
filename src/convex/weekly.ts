import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./identity";
import { todayISO } from "./data";

/* ═══════════════════════════════════════════════════════════════════════
   Weekly Report — computed live from EXISTING tables:
   xpEvents, practiceSessions, quizAttempts, notes, timetableEntries,
   stats (streaks). No new tracking tables, no duplicated data, no fake
   numbers: every metric is 0/null when there is no data.

   Week definition: Monday 00:00 → Sunday 23:59, LOCAL time.
   `weekOffset` 0 = current week, -1 = previous week, -2 = two ago, …
   ═══════════════════════════════════════════════════════════════════════ */

/** Local YYYY-MM-DD for a timestamp. */
function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Monday 00:00 (local) of the week containing `now`, shifted by offset weeks. */
function weekStart(now: Date, offset: number): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow + offset * 7);
  return d.getTime();
}

export const getWeeklyReport = query({
  args: { weekOffset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const offset = args.weekOffset ?? 0;
    const now = new Date();
    const start = weekStart(now, offset);
    const end = start + 7 * 86_400_000; // exclusive

    const inWeek = (ts: number) => ts >= start && ts < end;

    // ── XP events ────────────────────────────────────────────────────
    const xpEvents = await ctx.db
      .query("xpEvents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(2000);

    const weekXp = xpEvents.filter((e) => inWeek(e.createdAt));
    const xpEarned = weekXp.reduce((s, e) => s + e.amount, 0);
    const prevXpEarned = xpEvents
      .filter((e) => e.createdAt >= start - 7 * 86_400_000 && e.createdAt < start)
      .reduce((s, e) => s + e.amount, 0);

    // Days studied this week (any XP event counts as studying that day)
    const studyDays = new Set(weekXp.map((e) => localDay(e.createdAt)));
    const prevStudyDays = new Set(
      xpEvents
        .filter(
          (e) =>
            e.createdAt >= start - 7 * 86_400_000 && e.createdAt < start,
        )
        .map((e) => localDay(e.createdAt)),
    );

    // Per-day XP for the Mon–Sun chart
    const perDay: Array<{ day: string; label: string; xp: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start + i * 86_400_000);
      const key = localDay(d.getTime());
      perDay.push({
        day: key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
        xp: weekXp
          .filter((e) => localDay(e.createdAt) === key)
          .reduce((s, e) => s + e.amount, 0),
      });
    }

    // Longest streak WITHIN this week (consecutive study days)
    let longestThisWeek = 0;
    let run = 0;
    for (const d of perDay) {
      if (d.xp > 0) {
        run++;
        longestThisWeek = Math.max(longestThisWeek, run);
      } else {
        run = 0;
      }
    }

    // ── Notes generated ──────────────────────────────────────────────
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
    const weekNotes = notes.filter((n) => inWeek(n.createdAt));
    const topicsStudied = new Set<string>();
    for (const n of notes) {
      if (inWeek(n.createdAt)) topicsStudied.add(n.topic.trim().toLowerCase());
    }

    // Most studied topic (notes + quizzes + practice combined, this week)
    const topicCounts = new Map<string, number>();
    const bump = (t: string, by = 1) => {
      const k = t.trim().toLowerCase();
      if (!k) return;
      topicCounts.set(k, (topicCounts.get(k) ?? 0) + by);
    };
    for (const n of weekNotes) bump(n.topic);
    for (const a of await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000)) {
      if (inWeek(a.createdAt)) bump(a.topic);
    }

    // ── Practice sessions ────────────────────────────────────────────
    const practice = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
    const weekPractice = practice.filter((p) => inWeek(p.createdAt));
    const completedPractice = weekPractice.filter((p) => p.status === "completed");
    const prevPractice = practice.filter(
      (p) =>
        p.status === "completed" &&
        p.createdAt >= start - 7 * 86_400_000 &&
        p.createdAt < start,
    );

    // ── Quiz attempts ────────────────────────────────────────────────
    const quizzes = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
    const weekQuizzes = quizzes.filter((a) => inWeek(a.createdAt));

    // ── Accuracy (practice + notes quizzes, completed only) ──────────
    let points = 0;
    let questions = 0;
    for (const p of completedPractice) {
      questions += p.total;
      points += p.score ?? 0;
    }
    for (const a of weekQuizzes) {
      questions += a.total;
      points += a.score;
    }
    const accuracy = questions > 0 ? Math.round((points / questions) * 100) : null;

    let prevPoints = 0;
    let prevQuestions = 0;
    for (const p of prevPractice) {
      prevQuestions += p.total;
      prevPoints += p.score ?? 0;
    }
    const prevAccuracy =
      prevQuestions > 0 ? Math.round((prevPoints / prevQuestions) * 100) : null;

    const incorrect = questions - points;

    // ── Timetable tasks ──────────────────────────────────────────────
    const entries = await ctx.db
      .query("timetableEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const weekTasks = entries.filter((e) => {
      const t = new Date(`${e.date}T00:00:00`).getTime();
      return t >= start && t < end;
    });
    const tasksCompleted = weekTasks.filter((e) => e.completed).length;
    const tasksPlanned = weekTasks.length;
    // Study time from completed timetable entries (scheduled duration)
    const minutesStudied = weekTasks
      .filter((e) => e.completed)
      .reduce((sum, e) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = e.endTime.split(":").map(Number);
        return sum + Math.max((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0)), 0);
      }, 0);

    // ── Quests completed ─────────────────────────────────────────────
    const questCompletions = await ctx.db
      .query("questCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const questsCompleted = questCompletions.filter((q) => inWeek(q.completedAt)).length;

    // ── Global rank (live from stats, like the leaderboard) ──────────
    const allStats = await ctx.db.query("stats").collect();
    const me = allStats.find((s) => s.userId === userId);
    const myXp = me?.xp ?? 0;
    const rank =
      allStats.filter((s) => s.xp > myXp && !s.userId.startsWith("anon")).length + 1;

    // ── Current streak (existing system) ─────────────────────────────
    const streak = me?.streak ?? 0;

    // ── Most productive day ──────────────────────────────────────────
    const bestDay = perDay.reduce<(typeof perDay)[number] | null>(
      (best, d) => (d.xp > 0 && (!best || d.xp > best.xp) ? d : best),
      null,
    );

    // ── Week-over-week deltas ────────────────────────────────────────
    const pct = (cur: number | null, prev: number | null) => {
      if (cur === null || prev === null || prev === 0) return null;
      return Math.round(cur - prev);
    };

    return {
      weekStart: start,
      weekEnd: end - 1,
      rangeLabel: `${new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(end - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      isCurrentWeek: offset === 0,

      // Study activity
      sessions: studyDays.size, // XP-earning study sessions/days
      minutesStudied,
      topicsCount: topicsStudied.size,
      notesGenerated: weekNotes.length,
      practiceCompleted: completedPractice.length,
      quizzesCompleted: weekQuizzes.length,
      tasksCompleted,
      tasksPlanned,
      questsCompleted,

      // Performance
      accuracy,
      questions,
      correct: points,
      incorrect,
      xpEarned,
      rank,

      // Consistency
      studyDays: studyDays.size,
      streak,
      longestThisWeek,

      // Chart
      perDay,
      bestDay: bestDay ? { label: bestDay.label, xp: bestDay.xp } : null,

      // Highlights
      topTopic: (() => {
        let top: string | null = null;
        let count = 0;
        for (const [t, c] of topicCounts) {
          if (c > count) {
            top = t;
            count = c;
          }
        }
        return top;
      })(),

      // Comparisons vs previous week (null = not enough history)
      compare: {
        xp: xpEvents.some((e) => e.createdAt < start) ? xpEarned - prevXpEarned : null,
        accuracy: pct(accuracy, prevAccuracy),
        sessions: prevStudyDays.size > 0 || studyDays.size > 0 ? studyDays.size - prevStudyDays.size : null,
      },

      today: todayISO(),
    };
  },
});
