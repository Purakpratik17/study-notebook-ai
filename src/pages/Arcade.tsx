import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, FlaskConical, Gamepad2, Lock, Maximize2, Minimize2, Pause, Play, RefreshCw, RotateCcw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSounds } from "@/hooks/use-settings";
import { maybeShowInterstitial } from "@/lib/ads";
import { LoadingScreen } from "@/components/loading";

/* ═══════════════════════════════════════════════════════════════════════
   Arcade hub — Study Blocks + Study Bee
   Original games, original code, no third-party assets.
   ═══════════════════════════════════════════════════════════════════════ */

type GameRow = {
  id: "blocks" | "bee";
  name: string;
  desc: string;
  unlockHint: string;
  icon: string;
  unlocked: boolean;
  bestScore: number;
};

type Screen = "hub" | "blocks" | "bee";

export default function Arcade() {
  const sounds = useSounds();
  const arcade = useQuery(api.arcade.getArcade);
  const devUnlock = useMutation(api.arcade.devUnlockGame);
  const devReset = useMutation(api.arcade.devResetArcade);
  const [screen, setScreen] = useState<Screen>("hub");
  const [justUnlocked, setJustUnlocked] = useState<GameRow["id"] | null>(null);
  // Dev-only preview overlays: purely client-side, never written to the DB.
  // import.meta.env.DEV is statically replaced, so this is false in prod
  // builds and the whole panel below is dead-code-eliminated.
  const [devPreview, setDevPreview] = useState<{ blocks: boolean; bee: boolean }>(
    { blocks: false, bee: false },
  );
  const isDev = import.meta.env.DEV;

  const games: GameRow[] = (arcade?.games ?? []).map((g) => ({
    ...g,
    unlocked: g.unlocked || (isDev && devPreview[g.id]),
  }));

  // Detect newly unlocked games for the celebration modal.
  const prevRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!arcade) return;
    for (const g of arcade.games) {
      if (g.unlocked && !prevRef.current[g.id]) {
        if (Object.keys(prevRef.current).length > 0) setJustUnlocked(g.id);
        prevRef.current[g.id] = true;
      }
    }
  }, [arcade]);

  if (arcade === undefined) {
    return (
      <div className="paper-sheet flex items-center justify-center px-5 py-10">
        <LoadingScreen message="powering up the arcade…" />
      </div>
    );
  }

  if (screen !== "hub") {
    return (
      <GameShell gameId={screen} onExit={() => setScreen("hub")}>
        {screen === "blocks" ? <StudyBlocks /> : <StudyBee />}
      </GameShell>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Gamepad2 className="size-7 text-primary" /> Arcade
        </h1>
        <p className="annotation text-sm">
          a hidden game room — earned through studying, not instead of it
        </p>
        <p className="w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
          Games stay unlocked forever. Once you earn them, they're yours. 🏆
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {games.map((g) => (
          <article
            key={g.id}
            className={cn(
              "paper-sheet relative flex flex-col gap-3 px-5 py-5",
              g.unlocked && "spiral-edge",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl">{g.unlocked ? g.icon : "🔒"}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                  g.unlocked
                    ? "bg-xp/15 text-xp"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {g.unlocked ? "🎮 Unlocked" : "🔒 Locked"}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{g.name}</h2>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
            </div>
            {g.unlocked ? (
              <>
                <p className="flex items-center gap-1.5 text-sm font-bold text-marker">
                  <Trophy className="size-4 text-yellow-500" /> Best:{" "}
                  {g.bestScore.toLocaleString()}
                </p>
                <button
                  onClick={() => setScreen(g.id)}
                  className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Play className="size-4" /> Play now
                </button>
              </>
            ) : (
              <p className="mt-auto rounded-lg border border-dashed bg-card/60 px-3 py-2.5 text-xs text-muted-foreground">
                🔒 Unlock by: {g.unlockHint}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* ── DEV/TEST panel — compiled OUT of production builds entirely.
          import.meta.env.DEV is statically false in `npm run build`, so
          Vite tree-shakes this block and its handlers from the bundle. */}
      {isDev && (
        <section
          aria-label="Developer test controls"
          className="rounded-lg border-2 border-dashed border-red-400/70 bg-red-50/60 px-4 py-3 text-xs"
        >
          <summary className="flex cursor-pointer items-center gap-2 font-black uppercase tracking-wide text-red-700">
            <FlaskConical className="size-4" /> DEV / TEST — not a real achievement
          </summary>
          <p className="mt-2 text-muted-foreground">
            Development-only controls. Preview unlocks are client-side only
            (nothing is written to Convex) and vanish on refresh. Server test
            unlocks require the <code>ARCADE_DEV_UNLOCK=enabled</code> env var
            on the deployment and write permanent flags — use for end-to-end
            testing, then reset. Real XP and study/quest records are never
            touched.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setDevPreview((p) => ({ ...p, blocks: true }))}
              className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              Preview Study Blocks
            </button>
            <button
              onClick={() => setDevPreview((p) => ({ ...p, bee: true }))}
              className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              Preview Study Bee
            </button>
            <button
              onClick={() => setDevPreview({ blocks: false, bee: false })}
              className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              Clear Previews
            </button>
            <button
              onClick={async () => {
                try {
                  await devUnlock({ gameId: "blocks" });
                  toast.success("Study Blocks unlocked permanently (server test)");
                } catch {
                  toast.error("Set ARCADE_DEV_UNLOCK=enabled on the deployment first");
                }
              }}
              className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              Server Unlock Blocks
            </button>
            <button
              onClick={async () => {
                try {
                  await devUnlock({ gameId: "bee" });
                  toast.success("Study Bee unlocked permanently (server test)");
                } catch {
                  toast.error("Set ARCADE_DEV_UNLOCK=enabled on the deployment first");
                }
              }}
              className="rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              Server Unlock Bee
            </button>
            <button
              onClick={async () => {
                try {
                  await devReset();
                  toast.success("Server test unlocks cleared — real conditions restored");
                } catch {
                  toast.error("Set ARCADE_DEV_UNLOCK=enabled on the deployment first");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 font-semibold hover:bg-accent"
            >
              <RotateCcw className="size-3.5" /> Reset Arcade Test State
            </button>
          </div>
        </section>
      )}

      {/* Unlock celebration modal */}
      {justUnlocked && (
        <UnlockModal
          game={games.find((g) => g.id === justUnlocked)!}
          onClose={() => setJustUnlocked(null)}
          onPlay={() => {
            setScreen(justUnlocked);
            setJustUnlocked(null);
          }}
        />
      )}
    </div>
  );
}

/** GameShell — wraps an active game and provides a fullscreen toggle that
 *  hides all surrounding UI (back button, page padding, chrome) so gameplay
 *  gets the full screen. The toggle sits outside the game's own controls and
 *  never interrupts play. */
function GameShell({
  gameId,
  onExit,
  children,
}: {
  gameId: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        fullscreen &&
          "fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-background p-3",
      )}
    >
      <div className={cn("flex items-center gap-2", fullscreen && "justify-end")}>
        {!fullscreen && (
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Back to Arcade
          </button>
        )}
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold transition hover:bg-accent active:scale-95"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? (
            <>
              <Minimize2 className="size-4" /> Exit fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="size-4" /> Fullscreen
            </>
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

function UnlockModal({
  game,
  onClose,
  onPlay,
}: {
  game: GameRow;
  onClose: () => void;
  onPlay: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-bounce-in w-full max-w-sm rounded-2xl border-2 border-highlight/50 bg-paper p-8 text-center shadow-2xl"
      >
        <p className="text-5xl">🔓</p>
        <h2 className="mt-3 text-xl font-black tracking-tight">
          {game.id === "blocks" ? "SECRET UNLOCKED" : "NEW ARCADE GAME"}
        </h2>
        <p className="annotation mt-1 text-sm">
          {game.id === "blocks"
            ? "4 hours of focused study completed."
            : "25 quests completed!"}
        </p>
        <p className="mt-4 text-3xl">{game.icon}</p>
        <p className="text-lg font-bold">{game.name}</p>
        <p className="annotation mt-1 text-sm">
          {game.id === "blocks"
            ? "You earned a break."
            : "Your next break just got interesting."}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onPlay}
            className="h-12 rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md active:scale-[0.98]"
          >
            🎮 {game.id === "blocks" ? "Play now" : "Play"}
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-lg border bg-card text-sm font-semibold hover:bg-accent"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   GAME 1 — STUDY BLOCKS (original falling-block puzzle)
   ═══════════════════════════════════════════════════════════════════════ */

const COLS = 10;
const ROWS = 18;
const BASE_FALL_MS = 700;
const FAST_FALL_MS = 90;

type Cell = string | null;
type Board = Cell[][];
type Piece = { cells: number[][]; x: number; y: number; color: string };

const PIECES: { cells: number[][]; color: string }[] = [
  { cells: [[1, 1, 1, 1]], color: "#38bdf8" },
  { cells: [[1, 1], [1, 1]], color: "#facc15" },
  { cells: [[0, 1, 0], [1, 1, 1]], color: "#a78bfa" },
  { cells: [[1, 0, 0], [1, 1, 1]], color: "#fb923c" },
  { cells: [[0, 0, 1], [1, 1, 1]], color: "#34d399" },
  { cells: [[1, 1, 0], [0, 1, 1]], color: "#f87171" },
  { cells: [[0, 1, 1], [1, 1, 0]], color: "#f472b6" },
];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}
function rotate(cells: number[][]): number[][] {
  const h = cells.length, w = cells[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) out[c][h - 1 - r] = cells[r][c];
  return out;
}
function collides(board: Board, p: Piece): boolean {
  for (let r = 0; r < p.cells.length; r++)
    for (let c = 0; c < p.cells[r].length; c++) {
      if (!p.cells[r][c]) continue;
      const x = p.x + c, y = p.y + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  return false;
}

function StudyBlocks() {
  const sounds = useSounds();
  const best = useQuery(api.profiles.getTetrisHighScore) ?? 0;
  const saveScore = useMutation(api.arcade.saveScore);

  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);

  const start = () => {
    setBoard(emptyBoard());
    setPiece(null);
    setScore(0);
    setLines(0);
    setGameOver(false);
    setPaused(false);
    setRunning(true);
    setPiece(spawn());
  };
  const spawn = (): Piece => {
    const s = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { cells: s.cells, color: s.color, x: Math.floor((COLS - s.cells[0].length) / 2), y: 0 };
  };

  const step = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      const down = { ...prev, y: prev.y + 1 };
      if (!collides(boardRef.current, down)) return down;
      // lock
      const next = boardRef.current.map((row) => [...row]);
      prev.cells.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v && prev.y + r >= 0) next[prev.y + r][prev.x + c] = prev.color;
        }),
      );
      let cleared = 0;
      const filtered = next.filter((row) => {
        if (row.every(Boolean)) { cleared++; return false; }
        return true;
      });
      while (filtered.length < ROWS) filtered.unshift(Array<Cell>(COLS).fill(null));
      if (cleared > 0) {
        setLines((l) => l + cleared);
        setScore((s) => s + [0, 100, 300, 500, 800][cleared]);
      }
      setBoard(filtered);
      const nxt = spawn();
      if (collides(filtered, nxt)) {
        setRunning(false);
        setGameOver(true);
        return null;
      }
      return nxt;
    });
  }, []);

  const boardRef = useRef<Board>(board);
  useEffect(() => { boardRef.current = board; }, [board]);

  useEffect(() => {
    if (!running || paused || gameOver) return;
    const speed = Math.max(FAST_FALL_MS, BASE_FALL_MS - Math.floor(lines / 5) * 50);
    const id = setInterval(step, speed);
    return () => clearInterval(id);
  }, [running, paused, gameOver, step, lines]);

  const tryMove = useCallback((dx: number) => {
    setPiece((prev) => {
      if (!prev) return prev;
      const moved = { ...prev, x: prev.x + dx };
      return collides(boardRef.current, moved) ? prev : moved;
    });
  }, []);

  const spin = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      const rotated = { ...prev, cells: rotate(prev.cells) };
      for (const dx of [0, -1, 1, -2, 2]) {
        const shifted = { ...rotated, x: prev.x + dx };
        if (!collides(boardRef.current, shifted)) return shifted;
      }
      return prev;
    });
  }, []);

  const drop = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      let p = prev;
      while (!collides(boardRef.current, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
      return p;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!running || paused) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); tryMove(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); tryMove(1); }
      if (e.key === "ArrowDown") { e.preventDefault(); step(); }
      if (e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); spin(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, paused, tryMove, spin, step]);

  // persist best score on game over
  useEffect(() => {
    if (gameOver && score > 0 && score > best) {
      saveScore({ gameId: "blocks", score }).catch(() => undefined);
      toast.success(`New Study Blocks best: ${score}! 🧱`);
      sounds.unlock();
    }
    if (gameOver) {
      // Natural break: game-over overlay is on screen. Never mid-game.
      void maybeShowInterstitial("gameResultsInterstitial");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const cellSize = Math.min(
    (typeof window !== "undefined" ? Math.min(window.innerWidth - 80, 300) : 280) / COLS,
    17,
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">🧱 Study Blocks</h1>
        <p className="annotation text-sm">clear lines, chase your best score</p>
      </header>

      <div className="flex items-center justify-between px-1 text-sm font-bold">
        <span>Score: {score}</span>
        <span>Lines: {lines}</span>
        <span className="text-ink-soft"><Trophy className="mr-1 inline size-4 text-yellow-500" />{best}</span>
      </div>

      <div className="paper-sheet mx-auto w-fit px-3 py-3">
        <div
          className="relative grid gap-[2px] rounded-lg bg-paper-deep p-1.5"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const active =
                piece && r >= piece.y && r < piece.y + piece.cells.length &&
                c >= piece.x && c < piece.x + piece.cells[0].length &&
                piece.cells[r - piece.y][c - piece.x] === 1;
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: cellSize, height: cellSize,
                    background: active ? piece!.color : cell ?? "transparent",
                    boxShadow: active || cell ? "inset 0 -2px 0 rgba(0,0,0,0.15)" : undefined,
                    borderRadius: 2,
                  }}
                />
              );
            }),
          )}
          {(!running || paused) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-paper/90">
              <p className="text-lg font-black">
                {gameOver ? "Game over!" : paused ? "Paused" : "Ready?"}
              </p>
              {gameOver && <p className="annotation text-sm">score {score} · {lines} lines</p>}
              <button
                onClick={() => (gameOver || !running ? start() : setPaused(false))}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md active:scale-95"
              >
                {gameOver ? "Restart" : paused ? "Resume" : "Start"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* touch controls */}
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
        <button aria-label="Move left" onClick={() => tryMove(-1)} className="min-h-14 rounded-xl border bg-card text-2xl font-bold shadow-sm active:scale-95">←</button>
        <button aria-label="Rotate" onClick={spin} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">⟳</button>
        <button aria-label="Move right" onClick={() => tryMove(1)} className="min-h-14 rounded-xl border bg-card text-2xl font-bold shadow-sm active:scale-95">→</button>
        <button aria-label="Soft drop" onClick={step} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">↓</button>
        <button aria-label="Hard drop" onClick={drop} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">⤓</button>
        <button
          aria-label={paused ? "Resume" : "Pause"}
          onClick={() => running && setPaused((p) => !p)}
          className="min-h-14 rounded-xl border bg-card shadow-sm active:scale-95"
        >
          {paused ? <Play className="mx-auto size-5" /> : <Pause className="mx-auto size-5" />}
        </button>
      </div>
      <p className="annotation text-center text-xs">
        desktop: arrows + space to rotate · score is saved to your notebook
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   GAME 2 — STUDY BEE (original tap-to-fly, study-themed obstacles)
   ═══════════════════════════════════════════════════════════════════════ */

const WORLD_W = 320;
const WORLD_H = 420;
const GRAVITY = 0.45;
const FLAP = -7.2;
const GAP = 130;
const OBSTACLE_W = 52;
const SPEED_BASE = 2.4;

type Obstacle = { x: number; gapY: number; scored: boolean };

function StudyBee() {
  const sounds = useSounds();
  const best = useQuery(api.profiles.getBeeHighScore) ?? 0;
  const saveScore = useMutation(api.arcade.saveScore);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    y: WORLD_H / 2,
    vy: 0,
    obstacles: [] as Obstacle[],
    frame: 0,
    score: 0,
  });

  const reset = () => {
    stateRef.current = { y: WORLD_H / 2, vy: 0, obstacles: [], frame: 0, score: 0 };
    setScore(0);
  };
  const start = () => {
    reset();
    setGameOver(false);
    setPaused(false);
    setRunning(true);
  };
  const flap = useCallback(() => {
    if (!running || paused) return;
    stateRef.current.vy = FLAP;
  }, [running, paused]);

  // input: tap / click / spacebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        if (!running || gameOver) start();
        else flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, gameOver]);

  useEffect(() => {
    if (!running || paused) return;
    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      s.frame++;
      s.vy += GRAVITY;
      s.y += s.vy;

      const speed = SPEED_BASE + Math.min(s.score * 0.08, 1.6);
      // spawn obstacles
      const last = s.obstacles[s.obstacles.length - 1];
      if (!last || last.x < WORLD_W - 190) {
        s.obstacles.push({
          x: WORLD_W + OBSTACLE_W,
          gapY: 70 + Math.random() * (WORLD_H - GAP - 140),
          scored: false,
        });
      }
      // move + score + collide
      for (const o of s.obstacles) o.x -= speed;
      s.obstacles = s.obstacles.filter((o) => o.x + OBSTACLE_W > -10);
      const bx = 60, br = 13;
      for (const o of s.obstacles) {
        if (!o.scored && o.x + OBSTACLE_W < bx - br) {
          o.scored = true;
          s.score++;
          setScore(s.score);
        }
        const overlapX = bx + br > o.x && bx - br < o.x + OBSTACLE_W;
        const hitTop = s.y - br < o.gapY;
        const hitBottom = s.y + br > o.gapY + GAP;
        if (overlapX && (hitTop || hitBottom)) {
          setRunning(false);
          setGameOver(true);
          return;
        }
      }
      if (s.y + br > WORLD_H || s.y - br < 0) {
        setRunning(false);
        setGameOver(true);
        return;
      }

      draw(canvasRef.current, s, bx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, paused]);

  // persist best on game over
  useEffect(() => {
    if (gameOver && score > 0 && score > best) {
      saveScore({ gameId: "bee", score }).catch(() => undefined);
      toast.success(`New Study Bee best: ${score}! 🐝`);
      sounds.unlock();
    }
    if (gameOver) {
      // Natural break: game-over overlay is on screen. Never mid-game.
      void maybeShowInterstitial("gameResultsInterstitial");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">🐝 Study Bee</h1>
        <p className="annotation text-sm">tap / click / spacebar to fly · squeeze through the study supplies</p>
      </header>

      <div className="flex items-center justify-between px-1 text-sm font-bold">
        <span>Score: {score}</span>
        <span className="text-ink-soft"><Trophy className="mr-1 inline size-4 text-yellow-500" />{best}</span>
      </div>

      <div className="paper-sheet mx-auto w-fit">
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className="max-w-full rounded-lg bg-sky-100 touch-none"
          style={{ width: "min(320px, 88vw)", height: "auto", aspectRatio: `${WORLD_W}/${WORLD_H}` }}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!running || gameOver) start();
            else flap();
          }}
        />
        {(!running || paused) && (
          <div className="pointer-events-none absolute" />
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xs gap-2">
        <button
          onClick={() => (!running || gameOver ? start() : setPaused((p) => !p))}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md active:scale-[0.98]"
        >
          {gameOver ? <><RefreshCw className="size-4" /> Restart</> : paused ? <><Play className="size-4" /> Resume</> : running ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Start</>}
        </button>
      </div>

      {gameOver && (
        <p className="annotation text-center text-sm">
          Game over — score {score}. Tap the canvas or press space to fly again.
        </p>
      )}
      {!running && !gameOver && (
        <p className="annotation text-center text-sm">
          Tap the canvas or press Start to begin.
        </p>
      )}
    </section>
  );
}

/** Canvas renderer — original study-themed art (book stacks as obstacles). */
function draw(
  canvas: HTMLCanvasElement | null,
  s: { y: number; obstacles: Obstacle[]; frame: number },
  beeX: number,
) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const { y, obstacles } = s;

  // sky
  ctx.fillStyle = "#e8f4fd";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // drifting clouds
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 3; i++) {
    const cx = ((s.frame * 0.4 + i * 140) % (WORLD_W + 80)) - 40;
    const cy = 50 + i * 55;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.arc(cx + 16, cy + 4, 12, 0, Math.PI * 2);
    ctx.arc(cx - 16, cy + 4, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  // floor: pencil line
  ctx.fillStyle = "#f5deb3";
  ctx.fillRect(0, WORLD_H - 8, WORLD_W, 8);
  ctx.fillStyle = "#e0a96d";
  ctx.fillRect(0, WORLD_H - 8, WORLD_W, 3);

  // obstacles: floating stacks of books
  for (const o of obstacles) {
    const bookColors = ["#e05d5d", "#5d8de0", "#63b463"];
    // top stack
    let by = o.gapY;
    while (by > -30) {
      ctx.fillStyle = bookColors[Math.abs(Math.round(by)) % 3];
      ctx.fillRect(o.x, by - 22, OBSTACLE_W, 20);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(o.x + 4, by - 18, OBSTACLE_W - 8, 3); // page edge
      by -= 22;
    }
    // bottom stack
    by = o.gapY + GAP;
    while (by < WORLD_H - 8) {
      ctx.fillStyle = bookColors[Math.abs(Math.round(by)) % 3];
      ctx.fillRect(o.x, by, OBSTACLE_W, 20);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(o.x + 4, by + 4, OBSTACLE_W - 8, 3);
      by += 22;
    }
  }

  // bee: body + stripes + wings
  const bx = beeX;
  const wingFlap = Math.sin(s.frame * 0.5) * 3;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(bx - 2, y - 11 + wingFlap * 0.4, 9, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6c344";
  ctx.beginPath();
  ctx.ellipse(bx, y, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b2f2f";
  ctx.fillRect(bx - 4, y - 9, 3, 18);
  ctx.fillRect(bx + 2, y - 9, 3, 18);
  ctx.beginPath();
  ctx.arc(bx + 9, y - 4, 1.8, 0, Math.PI * 2);
  ctx.fill();
}
