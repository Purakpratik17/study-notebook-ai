import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   Cerevyn loading system — one reusable visual language for every
   loading state in the app.

   Design rules:
   • Pure CSS transforms/opacity — smooth on low-end Android.
   • All ambient animation is disabled by prefers-reduced-motion and by
     the app's [data-animations="off"] setting (see index.css).
   • Never pretends to show real API progress (no fake percentages).
   • Loading behavior/API logic unchanged — visual only.
   ═══════════════════════════════════════════════════════════════════════ */

/** Animated open notebook with a gently writing pencil + floating
 *  study glyphs. Pure CSS, ~60 lines, no canvas. */
export function LoadingNotebook({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative flex h-20 w-24 items-center justify-center", className)}
      aria-hidden="true"
    >
      {/* book base */}
      <div className="loading-notebook relative h-14 w-20 rounded-md border-2 border-primary/70 bg-card shadow-sm">
        {/* spine */}
        <div className="absolute inset-y-0 left-2 w-px bg-primary/40" />
        {/* writing lines */}
        <div className="absolute inset-x-4 bottom-3 top-4 flex flex-col justify-between">
          <span className="loading-line h-0.5 rounded bg-primary/50" style={{ width: "85%" }} />
          <span className="loading-line h-0.5 rounded bg-primary/40" style={{ width: "65%", animationDelay: "0.15s" }} />
          <span className="loading-line h-0.5 rounded bg-marker/60" style={{ width: "75%", animationDelay: "0.3s" }} />
        </div>
        {/* pencil */}
        <span className="loading-pencil absolute -right-1 bottom-2 h-5 w-1.5 origin-bottom rounded-full bg-marker/80" />
      </div>
      {/* floating study glyphs */}
      <span className="loading-float absolute -left-2 top-0 text-sm">✦</span>
      <span className="loading-float absolute -top-1 right-2 text-xs" style={{ animationDelay: "0.8s" }}>π</span>
      <span className="loading-float absolute -bottom-1 left-4 text-xs" style={{ animationDelay: "1.6s" }}>A+</span>
      <span className="loading-float absolute -right-3 top-4 text-xs" style={{ animationDelay: "2.2s" }}>✎</span>
    </div>
  );
}

/** Full-screen centered loading (auth check, route chunks). */
export function LoadingScreen({ message = "checking your notebook…" }: { message?: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <LoadingNotebook />
      <p className="annotation animate-pulse text-sm">{message}</p>
    </div>
  );
}

/* ─── AI generation: rotating study phrases ──────────────────────────── */

const AI_PHASES = [
  "Cerevyn is studying this with you…",
  "Gathering the key concepts…",
  "Organizing your notes…",
  "Preparing examples…",
  "Building your quiz…",
  "Almost ready…",
];

/** Rotates through study phrases while the request is actually in flight.
 *  The interval is cleaned up when loading ends; it never shows fake
 *  numeric progress. */
export function useAiPhrases(active: boolean, intervalMs = 2600): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) {
      const r = window.setTimeout(() => setIdx(0), 0);
      return () => window.clearTimeout(r);
    }
    const id = setInterval(
      () => setIdx((i) => Math.min(i + 1, AI_PHASES.length - 1)),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return AI_PHASES[idx];
}

/** Rich AI-generation loading card: notebook, rotating phrase, gentle
 *  glow and an indeterminate study-progress bar (not real %). */
export function AiLoadingCard({
  topic,
  detail = "writing notes, examples and a quiz",
}: {
  topic: string;
  detail?: string;
}) {
  const phrase = useAiPhrases(true);
  return (
    <section className="ai-loading-card paper-sheet paper-margin flex flex-col items-center gap-4 px-5 py-8 text-center">
      <div className="ai-glow relative">
        <LoadingNotebook />
      </div>
      <div aria-live="polite">
        <p className="font-semibold" key={phrase}>
          <span className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300">
            {phrase}
          </span>
        </p>
        <p className="annotation mt-1 text-xs">
          studying “{topic.trim()}” — {detail}
        </p>
      </div>
      {/* indeterminate study bar — motion only, never a fake % */}
      <div className="ai-bar h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-paper-deep">
        <div className="ai-bar-fill h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-marker/70" />
      </div>
    </section>
  );
}

/* ─── Staged AI progress (honest, estimated) ─────────────────────────── */

const GEN_STAGES = [
  "Preparing topic",
  "Structuring content",
  "Generating material",
  "Checking the result",
  "Finalizing",
];

/**
 * Polished staged progress for AI generation. HONESTY RULE: the backend
 * gives no real percentage, so the bar advances on an easing curve that
 * never reaches 100% while the request is in flight (capped at ~90%), and
 * the stage label changes as time passes. It is an estimate, not a claim.
 */
export function AiProgressCard({
  topic,
  detail = "generating your study material",
}: {
  topic: string;
  detail?: string;
}) {
  const phrase = useAiPhrases(true);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(id);
  }, []);
  // Ease-out toward 90% — fast start, slowing creep, never completes.
  const pct = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 12000))));
  // Stage follows the (estimated) progress through the fixed pipeline.
  const stageIdx = Math.min(GEN_STAGES.length - 1, Math.floor((pct / 90) * GEN_STAGES.length));
  return (
    <section className="ai-loading-card paper-sheet paper-margin flex flex-col items-center gap-4 px-5 py-7 text-center">
      <div className="ai-glow relative">
        <LoadingNotebook />
      </div>
      <div aria-live="polite" className="w-full max-w-xs">
        <p className="text-sm font-semibold">Generating your study material…</p>
        <p className="annotation mt-0.5 text-xs">studying “{topic.trim()}” — {detail}</p>
        {/* estimated progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-marker/70 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span key={stageIdx} className="font-medium animate-in fade-in slide-in-from-right-1 duration-300">
            {GEN_STAGES[stageIdx]}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        {/* stage ticks */}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {GEN_STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i < stageIdx ? "w-4 bg-primary/70" : i === stageIdx ? "w-6 bg-primary" : "w-4 bg-border",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{phrase}</p>
      </div>
    </section>
  );
}

/* ─── Shimmer skeleton primitives ────────────────────────────────────── */

/** Shimmering block — drop-in replacement for animate-pulse blocks. */
export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

/** Notebook-branded shimmering text-row skeletons. */
export function ShimmerLines({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  const widths = ["92%", "78%", "85%", "60%", "88%"];
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer h-3 rounded"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/* ─── Button spinner (size-stable) ───────────────────────────────────── */

/** Fixed-size spinner slot so buttons never change size while loading. */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-4 shrink-0 animate-spin", className)}
    />
  );
}
