import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/TiltCard";
import { RainEffect } from "@/components/RainEffect";
import cerevynLogo from "@/assets/cerevyn-logo.svg";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  Flame,
  Users,
  Highlighter,
  NotebookPen,
  PenTool,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Study packs",
    body: "Type any topic — get clear notes, key exam points, formulas and a 5-question quiz in seconds.",
    accent: "bg-primary text-primary-foreground",
    glow: "var(--primary)",
  },
  {
    icon: CalendarDays,
    title: "Timetable that pays",
    body: "Plan study sessions, check them off, and watch every completed block convert into XP.",
    accent: "bg-xp text-white",
    glow: "var(--xp)",
  },
  {
    icon: Swords,
    title: "Daily quests",
    body: "A fresh board of challenges every day — easy to hard — with XP rewards for staying consistent.",
    accent: "bg-marker text-white",
    glow: "var(--marker)",
  },
  {
    icon: Trophy,
    title: "Levels & streaks",
    body: "Climb from Novice to Cerevyn Legend, keep your streak alive, and track every stat on your profile.",
    accent: "bg-highlight text-foreground",
    glow: "var(--highlight)",
  },
] as const;

const EXTRA_FEATURES = [
  {
    icon: Brain,
    title: "Flashcards",
    body: "Auto-built from your study packs — flip, shuffle, and let spaced repetition decide what comes back.",
  },
  {
    icon: Timer,
    title: "Focus mode",
    body: "A distraction-free timer that blocks the noise and banks the minutes into real, trackable study time.",
  },
  {
    icon: PenTool,
    title: "Infinite whiteboard",
    body: "Sketch diagrams, mind-maps and worked solutions by hand — save them straight into your library.",
  },
  {
    icon: Highlighter,
    title: "AI notes you can edit",
    body: "Every AI note is a living document — highlight, rewrite and annotate without losing the original.",
  },
  {
    icon: Eye,
    title: "Weekly reports",
    body: "See exactly where your hours went, which subjects slipped, and what to fix next week.",
  },
  {
    icon: Users,
    title: "Study buddies",
    body: "Share study packs with friends, compare XP on the leaderboard, and keep each other accountable.",
  },
] as const;

const COMPARISON: {
  feature: string;
  cerevyn: boolean | string;
  notebook: boolean | string;
  generic: boolean | string;
}[] = [
  { feature: "AI notes, quizzes & flashcards from any topic", cerevyn: true, notebook: false, generic: "partial" },
  { feature: "Timetable with sessions you can check off", cerevyn: true, notebook: "manual", generic: true },
  { feature: "XP, levels & daily quests for studying", cerevyn: true, notebook: false, generic: false },
  { feature: "Streaks that reward showing up daily", cerevyn: true, notebook: false, generic: "partial" },
  { feature: "Hand-drawn whiteboards saved with your notes", cerevyn: true, notebook: true, generic: false },
  { feature: "Share study packs with friends in-app", cerevyn: true, notebook: false, generic: "partial" },
  { feature: "Works offline-first on your phone", cerevyn: "soon", notebook: true, generic: "partial" },
  { feature: "Weekly report on where your time went", cerevyn: true, notebook: false, generic: "partial" },
];

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

/* Blur-in reveal — everything unloaded rises from a soft blur */
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 22, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-40px" as const },
  transition: {
    duration: 0.6,
    delay,
    ease: [0.22, 1, 0.36, 1] as const,
  },
});

function Cell({ v }: { v: boolean | string }) {
  if (v === true)
    return <Check className="mx-auto size-4 text-xp" aria-label="Yes" />;
  if (v === false)
    return <X className="mx-auto size-4 text-marker/60" aria-label="No" />;
  return (
    <span
      className={`text-xs font-semibold ${
        v === "manual" || v === "soon" ? "text-muted-foreground" : "text-ink-soft"
      }`}
    >
      {v === "partial" ? "partial" : v}
    </span>
  );
}

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative min-h-screen overflow-x-clip"
    >
      {/* Rain + ambient floating orbs (both self-skip on reduced motion) */}
      <RainEffect />
      <AmbientLanding />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
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
        <Button asChild variant="outline" className="btn-3d bg-card">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20">
        {/* ── Hero: layered 3D notebook ─────────────────────────────── */}
        <section className="relative mx-auto mt-8 max-w-3xl">
          <div
            aria-hidden
            className="hero-back-sheet absolute inset-x-6 -bottom-3 top-8 rotate-[1.6deg] rounded-xl bg-card/70 shadow-lg"
          />
          <div
            aria-hidden
            className="hero-back-sheet absolute inset-x-3 -bottom-1.5 top-4 rotate-[-1.2deg] rounded-xl bg-card shadow-md"
          />

          <FloatBadge
            className="-right-2 top-10 md:-right-10"
            delay="0s"
            glow="var(--xp)"
          >
            <Zap className="size-4 text-xp" />
            <span className="text-xs font-black">+100 XP</span>
          </FloatBadge>
          <FloatBadge
            className="-left-2 top-32 md:-left-12"
            delay="1.4s"
            glow="var(--marker)"
          >
            <Flame className="size-4 text-marker" />
            <span className="text-xs font-black">7-day streak</span>
          </FloatBadge>
          <FloatBadge
            className="right-6 -bottom-5 md:right-10"
            delay="0.8s"
            glow="var(--highlight)"
          >
            <CheckCircle2 className="size-4 text-primary" />
            <span className="text-xs font-black">Quiz complete!</span>
          </FloatBadge>

          <TiltCard maxTilt={4} className="relative">
            <motion.section
              initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="paper-sheet paper-margin relative px-6 py-10 pl-16 text-center md:py-14 md:pl-20"
            >
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
                <Button
                  asChild
                  size="lg"
                  className="btn-3d h-12 px-7 text-base font-bold"
                >
                  <Link to="/auth">
                    Start your notebook <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
                <span className="annotation text-sm">
                  free · sign in with email
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
            </motion.section>
          </TiltCard>
        </section>

        {/* ── Features: tilt-reactive cards with accent glow ────────── */}
        <section className="mt-16">
          <motion.h2
            {...reveal()}
            className="text-center text-2xl font-bold tracking-tight"
          >
            Everything a motivated student needs
          </motion.h2>
          <p className="annotation mt-1 text-center text-sm">
            one notebook, zero chaos
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <motion.article key={f.title} {...reveal(i * 0.07)}>
                <TiltCard maxTilt={7} className="h-full">
                  <div
                    className="feature-card paper-sheet spiral-edge flex h-full gap-4 px-5 py-5"
                    style={{ "--feature-glow": f.glow } as React.CSSProperties}
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
                  </div>
                </TiltCard>
              </motion.article>
            ))}
          </div>
        </section>

        {/* ── More features: deeper toolbox ─────────────────────────── */}
        <section className="mt-16">
          <motion.h2
            {...reveal()}
            className="text-center text-2xl font-bold tracking-tight"
          >
            …and a full toolbox underneath
          </motion.h2>
          <p className="annotation mt-1 text-center text-sm">
            every tool a semester demands
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRA_FEATURES.map((f, i) => (
              <motion.article key={f.title} {...reveal(i * 0.05)}>
                <TiltCard maxTilt={6} className="h-full">
                  <div className="feature-card paper-sheet h-full px-5 py-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
                      <f.icon className="size-4" />
                    </span>
                    <span className="mt-3 block font-bold">{f.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </span>
                  </div>
                </TiltCard>
              </motion.article>
            ))}
          </div>
        </section>

        {/* ── Comparison ────────────────────────────────────────────── */}
        <motion.section
          {...reveal()}
          className="paper-sheet spiral-edge mt-16 overflow-hidden px-6 py-8 md:px-8"
        >
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Why not just use a notebook app?
          </h2>
          <p className="annotation mt-1 text-center text-sm">
            Cerevyn vs the rest
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="compare-table w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[46%] py-3 text-left font-bold"></th>
                  <th className="py-3 text-center font-black text-primary">
                    <span className="inline-flex flex-col items-center gap-1">
                      <NotebookPen className="size-4" />
                      Cerevyn
                    </span>
                  </th>
                  <th className="py-3 text-center text-xs font-semibold text-muted-foreground">
                    Plain notebook
                  </th>
                  <th className="py-3 text-center text-xs font-semibold text-muted-foreground">
                    Generic AI apps
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="compare-row">
                    <td className="py-2.5 pr-3 text-left leading-snug">
                      {row.feature}
                    </td>
                    <td className="bg-primary/5 py-2.5 text-center">
                      <Cell v={row.cerevyn} />
                    </td>
                    <td className="py-2.5 text-center">
                      <Cell v={row.notebook} />
                    </td>
                    <td className="py-2.5 text-center">
                      <Cell v={row.generic} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Check = built in · Partial = possible with workarounds · Minus = not
            supported · “Soon” = native mobile in progress
          </p>
        </motion.section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <motion.section
          {...reveal()}
          className="paper-sheet paper-margin mt-16 px-6 py-8 pl-16 md:pl-20"
        >
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="annotation text-sm">the daily loop</p>
          <ol className="ruled-list mt-4 flex flex-col">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className="step-row flex cursor-default items-center gap-4 py-2.5 transition-transform"
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                <span className="text-sm font-black text-marker">{s.n}</span>
                <span className="text-sm font-medium sm:text-base">
                  {s.text}
                </span>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* ── Level ladder ──────────────────────────────────────────── */}
        <motion.section
          {...reveal()}
          className="paper-sheet spiral-edge mt-8 px-6 py-8"
        >
          <h2 className="text-2xl font-bold tracking-tight">
            Climb the level ladder
          </h2>
          <ul className="mt-5 flex flex-wrap gap-3">
            {RANKS.map((l, i) => (
              <motion.li
                key={l.lvl}
                initial={{ opacity: 0, scale: 0.85, filter: "blur(6px)" }}
                whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{
                  duration: 0.4,
                  delay: i * 0.03,
                  ease: [0.22, 1.2, 0.36, 1],
                }}
                whileHover={{ y: -4, scale: 1.04 }}
                className="rank-chip flex cursor-default items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5"
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
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* ── Final CTA ─────────────────────────────────────────────── */}
        <motion.section
          {...reveal()}
          className="relative mx-auto mt-16 max-w-2xl"
        >
          <TiltCard maxTilt={3}>
            <section className="paper-sheet paper-margin relative px-6 py-10 pl-16 text-center md:pl-20">
              <span className="tape" aria-hidden />
              <h2 className="text-3xl font-black tracking-tight">
                Your best semester starts with one page.
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Create a timetable, generate your first study pack, and earn
                your first 100 XP today.
              </p>
              <Button
                asChild
                size="lg"
                className="btn-3d mt-6 h-12 px-8 text-base font-bold"
              >
                <Link to="/auth">
                  Open my notebook <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </section>
          </TiltCard>
        </motion.section>
      </main>

      <footer className="relative z-10 border-t bg-card/60 py-6 text-center text-xs text-muted-foreground">
        Cerevyn — study smart, level up daily.
      </footer>
    </motion.div>
  );
}

/* Soft floating badge pinned to the hero — bobs gently, only when motion is on */
function FloatBadge({
  children,
  className,
  delay,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  delay: string;
  glow: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1.4, 0.36, 1] }}
      className={`hero-float absolute z-20 ${className ?? ""}`}
      style={
        { "--float-delay": delay, "--badge-glow": glow } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-md">
        {children}
      </div>
    </motion.div>
  );
}

/* Landing-local ambient orbs — light, theme-colored, self-skipping */
function AmbientLanding() {
  return (
    <div className="ambient-depth" aria-hidden>
      <i
        className="bg-xp/50"
        style={
          {
            width: 320,
            height: 320,
            top: "8%",
            left: "-8%",
            "--dur": "16s",
          } as React.CSSProperties
        }
      />
      <i
        className="bg-highlight/50"
        style={
          {
            width: 260,
            height: 260,
            top: "40%",
            right: "-6%",
            "--dur": "19s",
            "--delay": "2s",
          } as React.CSSProperties
        }
      />
      <i
        className="bg-primary/40"
        style={
          {
            width: 380,
            height: 380,
            bottom: "5%",
            left: "25%",
            "--dur": "22s",
            "--delay": "4s",
          } as React.CSSProperties
        }
      />
    </div>
  );
}
