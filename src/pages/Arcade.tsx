import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Gamepad2, Lock, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* ─── Tetris-inspired falling-block game (lightweight, mobile-friendly) ─── */

const COLS = 10;
const ROWS = 18;
const FALL_MS = 700;
const FAST_MS = 90;

type Cell = string | null;
type Board = Cell[][];
type Piece = { cells: number[][]; x: number; y: number; color: string };

const SHAPES: { cells: number[][]; color: string }[] = [
  { cells: [[1, 1, 1, 1]], color: "#38bdf8" }, // I
  { cells: [[1, 1], [1, 1]], color: "#facc15" }, // O
  { cells: [[0, 1, 0], [1, 1, 1]], color: "#a78bfa" }, // T
  { cells: [[1, 0, 0], [1, 1, 1]], color: "#fb923c" }, // L
  { cells: [[0, 0, 1], [1, 1, 1]], color: "#34d399" }, // J
  { cells: [[1, 1, 0], [0, 1, 1]], color: "#f87171" }, // S
  { cells: [[0, 1, 1], [1, 1, 0]], color: "#f472b6" }, // Z
];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function rotate(cells: number[][]): number[][] {
  const h = cells.length;
  const w = cells[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) out[c][h - 1 - r] = cells[r][c];
  return out;
}

function spawnPiece(): Piece {
  const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    cells: s.cells,
    color: s.color,
    x: Math.floor((COLS - s.cells[0].length) / 2),
    y: 0,
  };
}

function collides(board: Board, p: Piece): boolean {
  for (let r = 0; r < p.cells.length; r++) {
    for (let c = 0; c < p.cells[r].length; c++) {
      if (!p.cells[r][c]) continue;
      const x = p.x + c;
      const y = p.y + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function merge(board: Board, p: Piece): { board: Board; cleared: number } {
  const next = board.map((row) => [...row]);
  p.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v && p.y + r >= 0) next[p.y + r][p.x + c] = p.color;
    }),
  );
  let cleared = 0;
  const filtered = next.filter((row) => {
    if (row.every(Boolean)) {
      cleared++;
      return false;
    }
    return true;
  });
  while (filtered.length < ROWS) filtered.unshift(Array<Cell>(COLS).fill(null));
  return { board: filtered, cleared };
}

export default function Arcade() {
  const unlocked = useQuery(api.profiles.hasArcade);
  const best = useQuery(api.profiles.getTetrisHighScore) ?? 0;
  const saveScore = useMutation(api.profiles.setTetrisHighScore);

  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    setBoard(emptyBoard());
    setPiece(spawnPiece());
    setScore(0);
    setLines(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  const lockPiece = useCallback((p: Piece) => {
    setBoard((prev) => {
      const { board: merged, cleared } = merge(prev, p);
      if (cleared > 0) {
        setLines((l) => l + cleared);
        setScore((s) => s + [0, 100, 300, 500, 800][cleared]);
      }
      return merged;
    });
    setPiece((prev) => {
      const next = spawnPiece();
      if (collides(prev === null ? emptyBoard() : board, next)) {
        setRunning(false);
        setGameOver(true);
        return null;
      }
      return next;
    });
  }, [board]);

  const step = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      const down = { ...prev, y: prev.y + 1 };
      if (!collides(board, down)) return down;
      // lock at bottom
      const merged = merge(board, prev);
      if (merged.cleared > 0) {
        setLines((l) => l + merged.cleared);
        setScore((s) => s + [0, 100, 300, 500, 800][merged.cleared]);
      }
      const next = spawnPiece();
      if (collides(merged.board, next)) {
        setRunning(false);
        setGameOver(true);
        return null;
      }
      setBoard(merged.board);
      return next;
    });
  }, [board]);

  // gravity loop
  useEffect(() => {
    if (!running || gameOver) return;
    const speed = Math.max(FAST_MS, FALL_MS - Math.floor(lines / 5) * 50);
    const id = setInterval(step, speed);
    return () => clearInterval(id);
  }, [running, gameOver, step, lines]);

  const move = useCallback((dx: number) => {
    setPiece((prev) => {
      if (!prev) return prev;
      const moved = { ...prev, x: prev.x + dx };
      return collides(board, moved) ? prev : moved;
    });
  }, [board]);

  const drop = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      let p = prev;
      while (!collides(board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
      return p;
    });
  }, [board]);

  const spin = useCallback(() => {
    setPiece((prev) => {
      if (!prev) return prev;
      const rotated = { ...prev, cells: rotate(prev.cells) };
      for (const dx of [0, -1, 1, -2, 2]) {
        const shifted = { ...rotated, x: prev.x + dx };
        if (!collides(board, shifted)) return shifted;
      }
      return prev;
    });
  }, [board]);

  const tryMove = useCallback(
    (dx: number) => {
      setPiece((prev) => {
        if (!prev) return prev;
        const moved = { ...prev, x: prev.x + dx };
        return collides(board, moved) ? prev : moved;
      });
    },
    [board],
  );

  const moveDown = useCallback(() => step(), [step]);

  // keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!running) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); tryMove(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); tryMove(1); }
      if (e.key === "ArrowDown") { e.preventDefault(); moveDown(); }
      if (e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); spin(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, tryMove, spin, moveDown]);

  // save high score when game ends
  useEffect(() => {
    if (gameOver && score > 0 && score > best) {
      saveScore({ score }).catch(() => undefined);
      toast.success(`New high score: ${score}! 🏆`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const cellSize = Math.min(
    (typeof window !== "undefined" ? Math.min(window.innerWidth - 80, 320) : 280) / COLS,
    18,
  );

  if (unlocked === undefined) {
    return <div className="paper-sheet px-5 py-10 text-center annotation">loading…</div>;
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Gamepad2 className="size-7 text-primary" /> Study Arcade
          </h1>
          <p className="annotation mt-1 text-sm">a secret reward for serious focus</p>
        </header>
        <section className="paper-sheet flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-highlight-soft/60 text-3xl">🔒</span>
          <h2 className="text-xl font-bold">Locked — keep studying!</h2>
          <p className="max-w-sm text-sm leading-relaxed text-foreground/80">
            Complete a <strong>single focused study session of 4 hours</strong> (240 minutes on
            the Focus timer) and a little falling-block surprise unlocks here forever.
          </p>
          <p className="annotation text-sm">no shortcuts — the block gods are watching 👀</p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Gamepad2 className="size-7 text-primary" /> Study Arcade
        </h1>
        <p className="annotation text-sm">unlocked with a 4-hour focus session 🎉 — play a round</p>
      </header>

      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-bold">Score: {score}</div>
        <div className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          <Trophy className="size-4 text-yellow-500" /> Best: {best}
        </div>
      </div>

      <section className="paper-sheet mx-auto w-fit px-4 py-4">
        <div
          ref={boardRef}
          className="relative grid gap-[2px] rounded-lg bg-paper-deep p-1.5"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isActive =
                piece &&
                r >= piece.y &&
                r < piece.y + piece.cells.length &&
                c >= piece.x &&
                c < piece.x + piece.cells[0].length &&
                piece.cells[r - piece.y][c - piece.x] === 1;
              return (
                <div
                  key={`${r}-${c}`}
                  className="rounded-[2px]"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: isActive ? piece!.color : cell ?? "transparent",
                    boxShadow: isActive || cell ? "inset 0 -2px 0 rgba(0,0,0,0.15)" : undefined,
                  }}
                />
              );
            }),
          )}
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-paper/85">
              {gameOver ? (
                <>
                  <p className="text-lg font-black">Game over!</p>
                  <p className="annotation text-sm">score {score} · {lines} lines</p>
                </>
              ) : (
                <p className="annotation text-sm">tap Start to play</p>
              )}
              <button
                onClick={start}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md active:scale-95"
              >
                {gameOver ? "Restart" : "Start"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* touch controls */}
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
        <button aria-label="Rotate" onClick={spin} className="col-span-1 min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">⟳</button>
        <button aria-label="Soft drop" onClick={moveDown} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">↓</button>
        <button aria-label="Hard drop" onClick={drop} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">⤓</button>
        <button aria-label="Move left" onClick={() => tryMove(-1)} className="min-h-14 rounded-xl border bg-card text-2xl font-bold shadow-sm active:scale-95">←</button>
        <button aria-label="Rotate" onClick={spin} className="min-h-14 rounded-xl border bg-card text-xl font-bold shadow-sm active:scale-95">⟳</button>
        <button aria-label="Move right" onClick={() => tryMove(1)} className="min-h-14 rounded-xl border bg-card text-2xl font-bold shadow-sm active:scale-95">→</button>
      </div>
      <p className="annotation text-center text-xs">keyboard: arrows + space also work · tap buttons on mobile · high score saved to your notebook</p>
    </div>
  );
}
