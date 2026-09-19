import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Circle,
  Download,
  Eraser,
  Highlighter,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSounds } from "@/hooks/use-settings";
import { LoadingNotebook } from "@/components/loading";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   WHITEBOARD — Cerevyn's study canvas.

   Original lightweight canvas implementation (no drawing library):
   • Pointer Events unify mouse / touch / stylus.
   • touch-action: none on the canvas prevents page scroll while drawing.
   • Elements are stored as a JSON document and rendered each frame;
     undo/redo is a simple snapshot stack.
   • Autosave is debounced 1200 ms and shows Saving…/Saved state.
   ═══════════════════════════════════════════════════════════════════════ */

type Element = {
  id: string;
  type: "path" | "line" | "arrow" | "rect" | "ellipse" | "text";
  points?: [number, number][];
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  color: string;
  size: number;
  text?: string;
  fontSize?: number;
  opacity?: number;
};

type Tool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "text"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "select"
  | "pan";

const PEN_COLORS = [
  "#1e293b",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#9333ea",
];
const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#93c5fd", "#fdba74"];
const ERASER_SIZE = 28;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ─── Rendering ──────────────────────────────────────────────────────── */

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  view: { x: number; y: number; zoom: number },
) {
  const { x: vx, y: vy, zoom } = view;
  const tx = (x: number) => (x - vx) * zoom;
  const ty = (y: number) => (y - vy) * zoom;

  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.size * zoom;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "path" && el.points) {
    ctx.beginPath();
    el.points.forEach(([px, py], i) =>
      i === 0 ? ctx.moveTo(tx(px), ty(py)) : ctx.lineTo(tx(px), ty(py)),
    );
    if (el.opacity === 0.001) {
      // Eraser strokes are drawn in destination-out style via a
      // background-colored stroke — simple and robust for export.
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = el.size * zoom;
    }
    ctx.stroke();
  } else if (el.type === "line" && el.x2 !== undefined) {
    ctx.beginPath();
    ctx.moveTo(tx(el.x!), ty(el.y!));
    ctx.lineTo(tx(el.x2), ty(el.y2!));
    ctx.stroke();
  } else if (el.type === "arrow" && el.x2 !== undefined) {
    const x1 = tx(el.x!), y1 = ty(el.y!), x2 = tx(el.x2), y2 = ty(el.y2!);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(10, el.size * 3) * Math.max(zoom, 0.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (el.type === "rect" && el.x2 !== undefined) {
    ctx.strokeRect(
      Math.min(tx(el.x!), tx(el.x2)),
      Math.min(ty(el.y!), ty(el.y2!)),
      Math.abs(tx(el.x2) - tx(el.x!)),
      Math.abs(ty(el.y2!) - ty(el.y!)),
    );
  } else if (el.type === "ellipse" && el.x2 !== undefined) {
    const cx = (tx(el.x!) + tx(el.x2)) / 2;
    const cy = (ty(el.y!) + ty(el.y2!)) / 2;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      Math.abs(tx(el.x2) - tx(el.x!)) / 2,
      Math.abs(ty(el.y2!) - ty(el.y!)) / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (el.type === "text") {
    ctx.font = `${(el.fontSize ?? 20) * zoom}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(el.text ?? "", tx(el.x!), ty(el.y!));
  }
  ctx.restore();
}

function elementBBox(el: Element) {
  if (el.type === "path" && el.points) {
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  const x1 = Math.min(el.x ?? 0, el.x2 ?? el.x ?? 0);
  const y1 = Math.min(el.y ?? 0, el.y2 ?? el.y ?? 0);
  const x2 = Math.max(el.x ?? 0, el.x2 ?? el.x ?? 0);
  const y2 = Math.max(el.y ?? 0, el.y2 ?? el.y ?? 0);
  return { x1, y1, x2, y2 };
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function Whiteboard({ embedded = false }: { embedded?: boolean }) {
  const boards = useQuery(api.whiteboards.list) ?? null;
  const createBoard = useMutation(api.whiteboards.create);
  const renameBoard = useMutation(api.whiteboards.rename);
  const deleteBoard = useMutation(api.whiteboards.remove);
  const saveBoard = useMutation(api.whiteboards.save);
  const { click: playClick } = useSounds();

  const [activeId, setActiveId] = useState<Id<"whiteboards"> | null>(null);
  // Fullscreen: canvas becomes the main focus and surrounding Cerevyn UI
  // (nav, top bar, drawer chrome) disappears behind a fixed overlay.
  const [fullscreen, setFullscreen] = useState(false);

  // Board state
  const [elements, setElements] = useState<Element[]>([]);
  const [redoStack, setRedoStack] = useState<Element[][]>([]);
  const historyRef = useRef<Element[][]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(3);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [grid, setGrid] = useState<"dots" | "grid" | "plain">("dots");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Draft (element being drawn)
  const draftRef = useRef<Element | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementsRef = useRef<Element[]>([]);
  elementsRef.current = elements;
  const viewRef = useRef(view);
  viewRef.current = view;

  const board = useQuery(
    api.whiteboards.get,
    activeId ? { id: activeId } : "skip",
  );

  // Load board content once fetched.
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (board && loadedRef.current !== board._id) {
      loadedRef.current = board._id;
      setElements(board.elements as unknown as Element[]);
      historyRef.current = [];
      setRedoStack([]);
      setSaveState("idle");
    }
  }, [board]);

  /* ─── Rendering loop ──────────────────────────────────────────────── */

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas-bg")
      .trim() || "#faf7ef";
    ctx.fillRect(0, 0, w, h);

    const v = viewRef.current;
    const step = 28 * v.zoom;
    const ox = ((-v.x * v.zoom) % step + step) % step;
    const oy = ((-v.y * v.zoom) % step + step) % step;
    ctx.fillStyle = "rgba(120,110,90,0.22)";
    if (grid === "dots") {
      for (let x = ox; x < w; x += step)
        for (let y = oy; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (grid === "grid") {
      ctx.strokeStyle = "rgba(120,110,90,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = ox; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = oy; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    for (const el of elementsRef.current) drawElement(ctx, el, v);
    if (draftRef.current) drawElement(ctx, draftRef.current, v);
  }, [grid]);

  useEffect(() => {
    render();
  }, [render, elements, view]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [render]);

  /* ─── Autosave (debounced) ────────────────────────────────────────── */

  const scheduleSave = useCallback(() => {
    if (!activeId) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveBoard({ id: activeId, elements: elementsRef.current as never });
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveState("idle");
        toast.error("Couldn't save the board. Will retry on next change.");
      }
    }, 1200);
  }, [activeId, saveBoard]);

  // Flush pending save before leaving the page.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (saveTimer.current && activeId) {
        clearTimeout(saveTimer.current);
        saveBoard({ id: activeId, elements: elementsRef.current as never }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      onBeforeUnload();
    };
  }, [activeId, saveBoard]);

  /* ─── History helpers ─────────────────────────────────────────────── */

  const pushHistory = useCallback((snapshot: Element[]) => {
    historyRef.current = [...historyRef.current.slice(-49), snapshot];
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setRedoStack((r) => [...r, elementsRef.current]);
    setElements(prev);
    setSaveState("saving");
    if (activeId) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveBoard({ id: activeId, elements: prev as never }).catch(() => {});
      }, 400);
    }
    playClick();
  }, [activeId, saveBoard, playClick]);

  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1];
      pushHistory(elementsRef.current);
      setElements(next);
      if (activeId) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveBoard({ id: activeId, elements: next as never }).catch(() => {});
        }, 400);
      }
      return r.slice(0, -1);
    });
    playClick();
  }, [activeId, pushHistory, saveBoard, playClick]);

  /* ─── Pointer handling ────────────────────────────────────────────── */

  const toWorld = (e: React.PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return [
      (e.clientX - rect.left) / v.zoom + v.x,
      (e.clientY - rect.top) / v.zoom + v.y,
    ];
  };

  const hitTest = (wx: number, wy: number): Element | null => {
    const tol = 12 / viewRef.current.zoom;
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      const el = elementsRef.current[i];
      const b = elementBBox(el);
      if (wx >= b.x1 - tol && wx <= b.x2 + tol && wy >= b.y1 - tol && wy <= b.y2 + tol)
        return el;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const [wx, wy] = toWorld(e);

    if (tool === "pan" || e.button === 1) {
      panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      return;
    }

    if (tool === "select") {
      const hit = hitTest(wx, wy);
      if (hit) {
        pushHistory(elementsRef.current);
        setElements((els) => els.filter((el) => el.id !== hit.id));
        draftRef.current = { ...hit, id: hit.id, _dragDX: wx - (hit.x ?? 0) } as never;
      }
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Text to add:");
      if (text && text.trim()) {
        pushHistory(elementsRef.current);
        const el: Element = {
          id: uid(),
          type: "text",
          x: wx,
          y: wy,
          color,
          size,
          text: text.trim(),
          fontSize: Math.max(14, size * 6),
        };
        setElements((els) => [...els, el]);
        scheduleSave();
      }
      return;
    }

    pushHistory(elementsRef.current);
    const base = { id: uid(), color, size, opacity: 1 };
    if (tool === "pen")
      draftRef.current = { ...base, type: "path", points: [[wx, wy]] };
    else if (tool === "highlighter")
      draftRef.current = {
        ...base,
        type: "path",
        points: [[wx, wy]],
        color: "#fde047",
        opacity: 0.35,
        size: size * 6,
      };
    else if (tool === "eraser")
      draftRef.current = {
        ...base,
        type: "path",
        points: [[wx, wy]],
        opacity: 0.001, // destination-out marker
        size: ERASER_SIZE,
      };
    else
      draftRef.current = {
        ...base,
        type: tool as Element["type"],
        x: wx,
        y: wy,
        x2: wx,
        y2: wy,
      };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      const { sx, sy, vx, vy } = panRef.current;
      setView((v) => ({
        ...v,
        x: vx - (e.clientX - sx) / v.zoom,
        y: vy - (e.clientY - sy) / v.zoom,
      }));
      return;
    }
    if (!draftRef.current) return;
    const [wx, wy] = toWorld(e);
    const d = draftRef.current;

    if (d.type === "path") {
      const pts = d.points!;
      const last = pts[pts.length - 1];
      if (Math.hypot(wx - last[0], wy - last[1]) > 1.5 / viewRef.current.zoom)
        draftRef.current = { ...d, points: [...pts, [wx, wy]] };
    } else {
      draftRef.current = { ...d, x2: wx, y2: wy };
    }
    render();
  };

  const onPointerUp = () => {
    panRef.current = null;
    const d = draftRef.current;
    draftRef.current = null;
    if (!d) return;

    if (d.type === "path" && d.opacity === 0.001) {
      // Eraser: remove elements near the eraser path instead of storing a stroke.
      const pts = d.points ?? [];
      setElements((els) =>
        els.filter((el) => {
          const b = elementBBox(el);
          const pad = d.size / 2 + 4;
          return !pts.some(
            ([px, py]) =>
              px >= b.x1 - pad && px <= b.x2 + pad && py >= b.y1 - pad && py <= b.y2 + pad,
          );
        }),
      );
    } else if (d.type === "path" && (d.points?.length ?? 0) < 2) {
      historyRef.current.pop(); // single tap — nothing to add
    } else {
      setElements((els) => [...els, d]);
    }
    scheduleSave();
    playClick();
  };

  /* ─── Element dragging (select tool) ──────────────────────────────── */
  // Implemented via the draft mechanism: on select-down we lift the element
  // out; on move we translate it; on up we put it back.

  const lastSelectPos = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (draftRef.current && tool === "select") return;
    lastSelectPos.current = null;
  });

  /* ─── Board management ────────────────────────────────────────────── */

  const handleCreate = async () => {
    playClick();
    try {
      const id = await createBoard({ title: "Untitled board" });
      setActiveId(id);
      toast.success("New board created");
    } catch {
      toast.error("Could not create board");
    }
  };

  const handleDelete = async (id: Id<"whiteboards">, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    playClick();
    await deleteBoard({ id });
    if (activeId === id) {
      setActiveId(null);
      setElements([]);
    }
    toast.success("Board deleted");
  };

  const handleRename = async () => {
    if (!board) return;
    const t = window.prompt("Rename board:", board.title);
    if (t && t.trim()) await renameBoard({ id: board._id, title: t.trim() });
  };

  const exportPng = () => {
    playClick();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${board?.title ?? "whiteboard"}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    toast.success("Exported as PNG");
  };

  /* ─── Toolbar UI ──────────────────────────────────────────────────── */

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = useMemo(
    () => [
      { id: "pen", icon: <Pencil className="size-4" />, label: "Pen" },
      { id: "highlighter", icon: <Highlighter className="size-4" />, label: "Highlighter" },
      { id: "eraser", icon: <Eraser className="size-4" />, label: "Eraser" },
      { id: "text", icon: <TypeIcon className="size-4" />, label: "Text" },
      { id: "line", icon: <Minus className="size-4" />, label: "Line" },
      { id: "arrow", icon: <ArrowRight className="size-4" />, label: "Arrow" },
      { id: "rect", icon: <Square className="size-4" />, label: "Rectangle" },
      { id: "ellipse", icon: <Circle className="size-4" />, label: "Circle" },
      { id: "select", icon: <Move className="size-4" />, label: "Select/Move" },
      { id: "pan", icon: <RotateCcw className="size-4" />, label: "Pan" },
    ],
    [],
  );

  /* ─── Board list view ─────────────────────────────────────────────── */

  if (!activeId) {
    return (
      <div
        className={cn(
          "mx-auto max-w-3xl space-y-6 p-4 pb-24 md:p-6",
          fullscreen && "fixed inset-0 z-[60] overflow-y-auto bg-background pb-10",
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">📝 Whiteboard</h1>
            <p className="text-sm text-muted-foreground">
              Sketch equations, draw graphs, and work through problems by hand.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="size-4" /> New board
          </Button>
        </div>

        {boards === null ? (
          <div className="flex justify-center py-16">
            <LoadingNotebook className="scale-75" />
          </div>
        ) : boards.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No boards yet — create your first whiteboard to start sketching!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {boards.map((b) => (
              <div
                key={b._id}
                className="group flex items-center justify-between rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    playClick();
                    setActiveId(b._id);
                  }}
                >
                  <div className="truncate font-semibold">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.elements.length} element{b.elements.length === 1 ? "" : "s"} ·{" "}
                    {new Date(b.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(b._id, b.title)}
                  aria-label={`Delete ${b.title}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Editor view ─────────────────────────────────────────────────── */

  return (
    <div
      className={cn(
        "flex flex-col bg-[#faf7ef] dark:bg-background",
        embedded && !fullscreen
          ? "h-[calc(78dvh-2.6rem)]"
          : fullscreen
            ? "fixed inset-0 z-[70]"
            : "fixed inset-0 z-30",
      )}
      style={
        fullscreen
          ? {
              // Real device viewport + keep controls out of notch/gesture bar.
              height: "100dvh",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              paddingLeft: "env(safe-area-inset-left, 0px)",
              paddingRight: "env(safe-area-inset-right, 0px)",
            }
          : undefined
      }
    >
      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          className="absolute right-3 z-20 flex items-center gap-1.5 rounded-full border bg-card/95 px-3 py-2 text-xs font-bold shadow-lg backdrop-blur transition active:scale-95"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
          aria-label="Exit fullscreen"
        >
          <Minimize2 className="size-4" /> Exit fullscreen
        </button>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
          ← Boards
        </Button>
        <button
          className="truncate rounded px-2 py-1 text-sm font-semibold hover:bg-accent"
          onClick={handleRename}
          title="Click to rename"
        >
          {board?.title ?? "…"}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "✓ Saved"
              : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setFullscreen(true)}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={exportPng} aria-label="Export PNG">
          <Download className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={() => {
            if (window.confirm("Clear the entire board?")) {
              pushHistory(elementsRef.current);
              setElements([]);
              scheduleSave();
            }
          }}
          aria-label="Clear board"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        {tools.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => {
              playClick();
              setTool(t.id);
            }}
            className={cn(
              "rounded-lg p-2 text-foreground/70 transition-colors hover:bg-accent",
              tool === t.id && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {t.icon}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        <button
          title="Undo"
          onClick={undo}
          className="rounded-lg p-2 text-foreground/70 hover:bg-accent"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          title="Redo"
          onClick={redo}
          disabled={redoStack.length === 0}
          className="rounded-lg p-2 text-foreground/70 hover:bg-accent disabled:opacity-40"
        >
          <Redo2 className="size-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        {(tool === "pen" ? PEN_COLORS : tool === "highlighter" ? HIGHLIGHT_COLORS : PEN_COLORS).map(
          (c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "size-6 rounded-full border-2 transition-transform",
                color === c ? "scale-110 border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ),
        )}
        <span className="mx-1 h-6 w-px bg-border" />
        <input
          type="range"
          min={1}
          max={14}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-20 accent-primary"
          aria-label="Pen thickness"
        />
        <span className="mx-1 h-6 w-px bg-border" />
        {(["dots", "grid", "plain"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGrid(g)}
            className={cn(
              "rounded-lg px-2 py-1 text-xs capitalize hover:bg-accent",
              grid === g && "bg-accent font-semibold",
            )}
          >
            {g}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        <button
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.25, v.zoom - 0.25) }))}
          className="rounded-lg p-2 hover:bg-accent"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-10 text-center text-xs">{Math.round(view.zoom * 100)}%</span>
        <button
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(4, v.zoom + 0.25) }))}
          className="rounded-lg p-2 hover:bg-accent"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
          className="rounded-lg px-2 py-1 text-xs hover:bg-accent"
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ touchAction: "none", cursor: tool === "pan" ? "grab" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
