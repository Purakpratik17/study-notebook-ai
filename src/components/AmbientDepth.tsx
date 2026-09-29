import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   AMBIENT DEPTH — soft theme-colored orbs drifting behind content.

   • Pure CSS transforms (blur + translate3d), pointer-events:none, sits
     at z-index -5 behind everything (in front of the -10 tab backdrop).
   • Only 5 orbs, desktop sizes vary — negligible GPU cost.
   • Skipped entirely on coarse pointers (mobile) and low-end devices
     (detected via deviceMemory / hardwareConcurrency), and frozen by
     prefers-reduced-motion / [data-animations="off"] in CSS.
   • Colors come 100% from existing tokens — palette untouched.
   ═══════════════════════════════════════════════════════════════════════ */

const ORBS = [
  { color: "var(--primary)", top: "6%", left: "78%", size: 180, dur: "16s", delay: "0s", opacity: 0.16 },
  { color: "var(--highlight)", top: "58%", left: "88%", size: 130, dur: "13s", delay: "1.5s", opacity: 0.13 },
  { color: "var(--marker)", top: "72%", left: "6%", size: 150, dur: "18s", delay: "0.8s", opacity: 0.12 },
  { color: "var(--xp)", top: "18%", left: "10%", size: 110, dur: "15s", delay: "2.2s", opacity: 0.1 },
  { color: "var(--chart-4)", top: "42%", left: "55%", size: 90, dur: "17s", delay: "3s", opacity: 0.09 },
] as const;

function shouldSkip(): boolean {
  if (typeof window === "undefined") return true;
  if (!window.matchMedia("(pointer: fine)").matches) return true; // mobile: skip
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory ?? 8) <= 2) return true; // low-memory device
  if ((navigator.hardwareConcurrency ?? 8) <= 2) return true; // low-core device
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return false;
}

export function AmbientDepth() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.animations === "off") return;
    if (!shouldSkip()) setEnabled(true);
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden className="ambient-depth">
      {ORBS.map((o, i) => (
        <i
          key={i}
          style={
            {
              top: o.top,
              left: o.left,
              width: o.size,
              height: o.size,
              background: o.color,
              opacity: o.opacity,
              "--dur": o.dur,
              "--delay": o.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
