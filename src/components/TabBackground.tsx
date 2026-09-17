import { useLocation } from "react-router";

/* ═══════════════════════════════════════════════════════════════════════
   TabBackground — gives each major Learnova section its own subtle
   notebook "world" while staying one cohesive brand. Pure CSS (no image
   assets), fixed behind content (-z-10, pointer-events-none), ink-based
   colors only so light/dark themes both stay readable. Doodles freeze
   under prefers-reduced-motion and when animations are turned off.
   ═════════════════════════════════════════════════════════════════════ */

type World = {
  cls: string;
  marks: string[];
};

const WORLDS: Record<string, World> = {
  "/dashboard": {
    cls: "tab-bg-dash",
    marks: ["✎", "π ≈ 3.14", "★", "todo ☐", "☕", "A+", "∑", "✓ done"],
  },
  "/practice": {
    cls: "tab-bg-practice",
    marks: ["x²", "∫", "±", "√", "π", "θ", "Δ", "ƒ(x)", "∞", "%"],
  },
  "/ai-study": {
    cls: "tab-bg-notes",
    marks: ["e = mc²", "H₂O", "Fig. 1", "n+1", "※", "def:", "a²+b²=c²", "∴"],
  },
  "/essay": {
    cls: "tab-bg-notes",
    marks: ["“…”", "¶", "Aa", "Ch. 1", "✎", "draft"],
  },
  "/projects": {
    cls: "tab-bg-notes",
    marks: ["{ }", "</>", "=>", "git ✓", "v1.0", "TODO"],
  },
  "/timetable": {
    cls: "tab-bg-timetable",
    marks: ["Mon", "09:00", "Tue", "★", "plan", "wk", "14d", "Wed"],
  },
  "/quests": {
    cls: "tab-bg-quests",
    marks: ["⚔", "✦", "N ↑", "route", "⚑", "lv", "✗ ✗ ✗", "✓"],
  },
  "/arcade": {
    cls: "tab-bg-arcade",
    marks: ["▶", "▲", "●", "■", "★", "1UP", "×2", "◆", "HI"],
  },
  "/leaderboard": {
    cls: "tab-bg-leaderboard",
    marks: ["①", "②", "③", "🏆", "★", "top", "✦", "№"],
  },
  "/profile": {
    cls: "tab-bg-profile",
    marks: ["me ☺", "★", "《", "《", "day 1", "mem", "✎"],
  },
};

/** Doodle marks are seeded per-route so they don't reshuffle on re-render. */
function seededMarks(
  marks: string[],
): Array<{ text: string; style: React.CSSProperties; drift: string }> {
  const spots = [
    { top: "12%", left: "6%", size: "1.4rem", rot: "-8deg" },
    { top: "22%", left: "88%", size: "1.1rem", rot: "6deg" },
    { top: "55%", left: "4%", size: "1.2rem", rot: "5deg" },
    { top: "70%", left: "92%", size: "1.5rem", rot: "-6deg" },
    { top: "38%", left: "78%", size: "1rem", rot: "3deg" },
    { top: "85%", left: "18%", size: "1.2rem", rot: "-4deg" },
    { top: "8%", left: "45%", size: "1rem", rot: "7deg" },
    { top: "62%", left: "60%", size: "1.1rem", rot: "-7deg" },
  ];
  return spots.map((spot, i) => {
    const text = marks[i % marks.length];
    const drift = i % 3 === 0 ? " drift" : "";
    return {
      text,
      style: {
        top: spot.top,
        left: spot.left,
        fontSize: spot.size,
        "--r": spot.rot,
        transform: `rotate(${spot.rot})`,
        animationDelay: `${(i % 4) * 1.7}s`,
      } as React.CSSProperties,
      drift,
    };
  });
}

export function TabBackground() {
  const { pathname } = useLocation();
  const world =
    WORLDS[pathname] ??
    // Essay/projects routes share the notes world; anything unknown gets none.
    null;
  if (!world) return null;

  return (
    <div className={`tab-bg ${world.cls}`} aria-hidden="true">
      {seededMarks(world.marks).map(({ text, style, drift }, i) => (
        <span key={i} className={drift} style={style}>
          {text}
        </span>
      ))}
    </div>
  );
}
