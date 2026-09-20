import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Pause, Play, Square, Timer as TimerIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";

const PRESETS = [25, 50] as const;

export default function FocusMode() {
  const sounds = useSounds();
  const startSession = useMutation(api.focus.start);
  const completeSession = useMutation(api.focus.complete);

  const [planned, setPlanned] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState("35");
  const [subject, setSubject] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // Clean timer handling: single interval, always cleaned up.
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      // Pure updater only — completion is handled by the effect below
      // (side effects inside a state updater can double-fire).
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const finish = useCallback(
    async (auto: boolean) => {
    if (finishing || startedAt === null || planned === null) return;
    setFinishing(true);
    setRunning(false);
    runningRef.current = false;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    try {
      const r = await completeSession({
        startedAt,
        plannedMinutes: planned,
        subject: subject.trim() || undefined,
      });
      if (r.ok) {
        if (r.xp.granted) {
          setXpEarned(r.xp.amount);
          toast.success(`+${r.xp.amount} XP — focus session complete! 🎯`);
          sounds.complete();
        } else {
          sounds.success();
          toast.info("Already rewarded for this session.");
        }
        for (const q of r.settledQuests) toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
      } else {
        toast.error(r.reason);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save session.");
    } finally {
      setFinishing(false);
      setStartedAt(null);
      startedAtRef.current = null;
      setPlanned(null);
      setRemaining(0);
      if (!auto) setSubject("");
    }
    },
    [finishing, startedAt, planned, subject, completeSession, sounds],
  );

  // Session completes when the timer hits zero.
  useEffect(() => {
    if (running && remaining === 0) {
      void finish(true); // finish stops the interval and resets running/refs
    }
  }, [running, remaining, finish]);

  // Stop the timer if the user leaves the page mid-session (no XP farming
  // by navigating away — completion is judged against the server start time).
  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const begin = async (minutes: number) => {
    if (running || finishing) return;
    try {
      const ts = await startSession({ plannedMinutes: minutes });
      startedAtRef.current = ts;
      setStartedAt(ts);
      setPlanned(minutes);
      setRemaining(minutes * 60);
      setXpEarned(null);
      sounds.click();
      setRunning(true);
      runningRef.current = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session.");
    }
  };



  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = planned ? 1 - remaining / (planned * 60) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">🎯 Focus Mode</h1>
        <p className="annotation text-sm">
          one topic, one timer, no distractions
        </p>
      </header>

      {xpEarned !== null && !running && planned === null && (
        <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="text-4xl">🏆</span>
          <p className="text-lg font-bold">+{xpEarned} XP earned</p>
          <p className="text-sm text-muted-foreground">Great focus. Your streak thanks you.</p>
        </section>
      )}

      {!running && planned === null ? (
        <section className="paper-sheet px-5 py-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Choose your session
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void begin(p)}
                className="flex min-h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background/60 p-4 transition hover:bg-accent active:scale-[0.98]"
              >
                <span className="text-2xl font-extrabold text-primary">{p}</span>
                <span className="text-xs font-medium text-muted-foreground">minutes</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              min={5}
              max={180}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="h-12 flex-1 rounded-lg border bg-background px-3 text-sm"
              placeholder="Custom minutes (5–180)"
              aria-label="Custom minutes"
            />
            <button
              type="button"
              onClick={() => {
                const n = Math.round(Number(customInput));
                if (!Number.isFinite(n) || n < 5 || n > 180) {
                  toast.error("Enter a duration between 5 and 180 minutes.");
                  return;
                }
                void begin(n);
              }}
              className="h-12 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground"
            >
              Start custom
            </button>
          </div>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What are you focusing on? (optional)"
            className="mt-3 h-12 w-full rounded-lg border bg-background px-3 text-sm"
            maxLength={120}
          />
          <p className="annotation mt-3 text-xs">
            finish the full session to earn +30 XP and real study time — the timer is verified
            on the server, so shortcuts don't count.
          </p>
        </section>
      ) : (
        <section className="paper-sheet flex flex-col items-center gap-6 px-6 py-10">
          <p className="annotation text-sm">{subject.trim() || "Focus session"}</p>
          <div
            className={cn(
              "select-none text-7xl font-extrabold tabular-nums tracking-tight",
              running ? "text-primary" : "text-muted-foreground",
            )}
            role="timer"
            aria-live="off"
          >
            {mm}:{ss}
          </div>
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-marker transition-all duration-1000"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-3">
            {running ? (
              <button
                type="button"
                onClick={() => {
                  setRunning(false);
                  runningRef.current = false;
                }}
                className="flex min-h-12 items-center gap-2 rounded-lg border px-6 font-bold"
              >
                <Pause className="size-4" /> Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRunning(true);
                  runningRef.current = true;
                }}
                className="flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 font-bold text-primary-foreground"
              >
                <Play className="size-4" /> Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => void finish(false)}
              disabled={finishing}
              className="flex min-h-12 items-center gap-2 rounded-lg border border-destructive/40 px-6 font-bold text-destructive disabled:opacity-50"
            >
              <Square className="size-4" /> End
            </button>
          </div>
          <p className="annotation flex items-center gap-1.5 text-xs">
            <TimerIcon className="size-3.5" />
            Ending early gives no XP unless the full time has genuinely elapsed.
          </p>
        </section>
      )}
    </div>
  );
}
