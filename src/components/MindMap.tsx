import { useState } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   MIND MAP — a compact radial map of a topic's sections & bullets.

   • Pure CSS + SVG lines — no libraries, no canvas, GPU-friendly.
   • Center node = the topic; around it one small node per section.
     Tapping a section node expands its 3–4 bullets inline.
   • Colors come only from theme tokens (primary/marker/highlight/xp).
   • Animation is minimal and honors reduced-motion conventions.
   ═══════════════════════════════════════════════════════════════════════ */

export type MindMapData = {
  topic: string;
  sections: Array<{
    heading: string;
    bullets: string[];
  }>;
};

const NODE_HUES = [
  "bg-primary/10 border-primary/40 text-primary",
  "bg-marker-soft/70 border-marker/40 text-foreground",
  "bg-highlight-soft border-highlight/50 text-foreground",
  "bg-xp/10 border-xp/40 text-foreground",
];

const LINE_HUES = ["var(--primary)", "var(--marker)", "var(--highlight)", "var(--xp)"];

export function MindMap({ data }: { data: MindMapData }) {
  const [open, setOpen] = useState<number | null>(null);
  const sections = data.sections.slice(0, 4);
  const n = Math.max(sections.length, 1);

  return (
    <div className="rounded-xl border bg-card/60 px-3 py-4">
      <p className="annotation mb-2 text-center text-[10px] font-semibold uppercase tracking-wider">
        topic map · tap a branch
      </p>

      <div className="relative mx-auto" style={{ width: "100%", maxWidth: 340 }}>
        {/* center node */}
        <div className="relative z-10 mx-auto flex w-fit max-w-[200px] items-center justify-center rounded-full border-2 border-primary bg-primary px-4 py-2 text-center text-xs font-bold leading-tight text-primary-foreground shadow-md">
          {data.topic}
        </div>

        {/* branches */}
        <div className="mt-3 flex flex-col gap-1.5">
          {sections.map((s, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="relative flex items-start gap-2">
                {/* connector */}
                <svg
                  aria-hidden
                  width="20"
                  height="20"
                  className="mt-2.5 shrink-0"
                >
                  <path
                    d="M 20 10 C 10 10, 8 10, 0 10"
                    stroke={LINE_HUES[i % LINE_HUES.length]}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                </svg>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-semibold transition-all active:scale-[0.98]",
                      NODE_HUES[i % NODE_HUES.length],
                      isOpen && "shadow-sm ring-1 ring-primary/30",
                    )}
                    aria-expanded={isOpen}
                  >
                    <span className="truncate">{s.heading}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] transition-transform",
                        isOpen && "rotate-90",
                      )}
                    >
                      ▶
                    </span>
                  </button>

                  {isOpen && (
                    <ul
                      className={cn(
                        "mt-1 ml-2 flex flex-col gap-1 border-l-2 pl-3",
                        i % 2 === 0 ? "border-primary/30" : "border-marker/30",
                      )}
                    >
                      {s.bullets.slice(0, 4).map((b, j) => (
                        <li
                          key={j}
                          className="text-[11px] leading-snug text-muted-foreground"
                        >
                          • {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {n < data.sections.length && (
          <p className="annotation mt-2 text-center text-[10px]">
            +{data.sections.length - n} more section
            {data.sections.length - n === 1 ? "" : "s"} below
          </p>
        )}
      </div>
    </div>
  );
}
