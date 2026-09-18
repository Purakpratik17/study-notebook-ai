import { Button } from "@/components/ui/button";
import cerevynLogo from "@/assets/cerevyn-logo.svg";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Flame,
  NotebookPen,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Study packs",
    body: "Type any topic — get clear notes, key exam points, formulas and a 5-question quiz in seconds.",
    accent: "bg-primary text-primary-foreground",
  },
  {
    icon: CalendarDays,
    title: "Timetable that pays",
    body: "Plan study sessions, check them off, and watch every completed block convert into XP.",
    accent: "bg-xp text-white",
  },
  {
    icon: Swords,
    title: "Daily quests",
    body: "A fresh board of challenges every day — easy to hard — with XP rewards for staying consistent.",
    accent: "bg-marker text-white",
  },
  {
    icon: Trophy,
    title: "Levels & streaks",
    body: "Climb from Novice to Cerevyn Legend, keep your streak alive, and track every stat on your profile.",
    accent: "bg-highlight text-foreground",
  },
] as const;

const STEPS = [
  { n: "01", text: "Create your timetable" },
  { n: "02", text: "Study AI-generated notes" },
  { n: "03", text: "Take the quiz" },
  { n: "04", text: "Check off tasks & quests" },
  { n: "05", text: "Earn XP — level up" },
] as const;

const RANKS = [
  { lvl: 1, name: "Novice", xp: "0 XP" },
  { lvl: 2, name: "Learner", xp: "500 XP" },
  { lvl: 3, name: "Explorer", xp: "1,200 XP" },
  { lvl: 4, name: "Thinker", xp: "2,000 XP" },
  { lvl: 5, name: "Scholar", xp: "3,200 XP" },
  { lvl: 6, name: "Achiever", xp: "4,800 XP" },
  { lvl: 7, name: "Mastermind", xp: "7,000 XP" },
  { lvl: 8, name: "Sage", xp: "10,000 XP" },
  { lvl: 9, name: "Virtuoso", xp: "14,000 XP" },
  { lvl: 10, name: "Cerevyn Legend", xp: "20,000 XP" },
] as const;

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
    >
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <img
            src={cerevynLogo}
            alt="Cerevyn logo"
            className="hidden h-9 rounded-lg sm:block"
          />
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm sm:hidden">
            <NotebookPen className="size-5" />
          </span>
          <span className="text-base font-bold tracking-tight">
            Cerevyn
            <span className="annotation ml-1.5 text-xs font-normal">ai</span>
          </span>
        </div>
        <Button asChild variant="outline" className="bg-card">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20">
        {/* Hero */}
        <section className="paper-sheet paper-margin relative mx-auto mt-4 max-w-3xl px-6 py-10 pl-16 text-center md:py-14 md:pl-20">
          <span className="tape" aria-hidden />
          <p className="annotation text-base">dear future top student,</p>
          <h1 className="mx-auto mt-3 max-w-xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
            Study consistently.{" "}
            <span className="marker-stroke">Level up.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Your notebook, timetable and AI tutor in one place — with XP,
            quests and levels to keep you showing up every single day.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-7 text-base font-bold">
              <Link to="/auth">
                Start your notebook <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <span className="annotation text-sm">
              free · sign in with Google or email
            </span>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-xp" /> XP for every study action
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="size-3.5 text-marker" /> Daily streaks
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpenCheck className="size-3.5 text-primary" /> Instant
              quizzes
            </span>
          </div>
        </section>

        {/* Features */}
        <section className="mt-14">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Everything a motivated student needs
          </h2>
          <p className="annotation mt-1 text-center text-sm">
            one notebook, zero chaos
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="paper-sheet spiral-edge flex gap-4 px-5 py-5"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${f.accent}`}
                >
                  <f.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-bold">{f.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </span>
                </span>
              </motion.article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="paper-sheet paper-margin mt-14 px-6 py-8 pl-16 md:pl-20">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="annotation text-sm">the daily loop</p>
          <ol className="ruled-list mt-4 flex flex-col">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-center gap-4 py-2.5">
                <span className="text-sm font-black text-marker">{s.n}</span>
                <span className="text-sm font-medium sm:text-base">
                  {s.text}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Level ladder */}
        <section className="paper-sheet spiral-edge mt-8 px-6 py-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Climb the level ladder
          </h2>
          <ul className="mt-5 flex flex-wrap gap-3">
            {RANKS.map((l) => (
              <li
                key={l.lvl}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5"
              >
                <span className="level-chip flex size-8 items-center justify-center rounded-full bg-highlight-soft text-sm font-black text-foreground">
                  {l.lvl}
                </span>
                <span>
                  <span className="block text-sm font-bold leading-tight">
                    {l.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {l.xp}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="paper-sheet paper-margin relative mx-auto mt-14 max-w-2xl px-6 py-10 pl-16 text-center md:pl-20">
          <h2 className="text-3xl font-black tracking-tight">
            Your best semester starts with one page.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Create a timetable, generate your first study pack, and earn your
            first 100 XP today.
          </p>
          <Button asChild size="lg" className="mt-6 h-12 px-8 text-base font-bold">
            <Link to="/auth">
              Open my notebook <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t bg-card/60 py-6 text-center text-xs text-muted-foreground">
        Cerevyn — study smart, level up daily.
      </footer>
    </motion.div>
  );
}
