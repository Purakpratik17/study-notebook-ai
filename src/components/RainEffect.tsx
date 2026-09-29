import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   RAIN — lightweight canvas rain streaks for the landing page.

   • Single fixed canvas behind content (pointer-events: none, z-index -3).
   • Draw calls are transform/alpha only — no layout work, no libraries.
   • Density scales down on small screens & low-core devices.
   • Fully disabled under prefers-reduced-motion and the app's own
     animations kill-switch ([data-animations="off"]).
   • Auto-pauses when the tab is hidden.
   ═══════════════════════════════════════════════════════════════════════ */

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  drift: number;
}

export function RainEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.animations === "off";
    if (reduced) return;

    // Skip on low-end devices (same rules as AmbientDepth)
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (
      window.matchMedia("(pointer: coarse)").matches &&
      ((nav.hardwareConcurrency ?? 4) <= 2 ||
        (nav.deviceMemory ?? 4) <= 2)
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let drops: Drop[] = [];
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;

    const spawn = (initial: boolean): Drop => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -30,
      len: 10 + Math.random() * 18,
      speed: 5 + Math.random() * 7,
      alpha: 0.08 + Math.random() * 0.16,
      drift: 0.4 + Math.random() * 0.9,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ~1 drop per 18k px² on desktop, sparser on small screens
      const count = Math.min(120, Math.max(30, Math.floor((w * h) / 18000)));
      drops = Array.from({ length: count }, () => spawn(true));
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.strokeStyle = `rgba(70, 110, 100, ${d.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.drift * 2, d.y + d.len);
        ctx.stroke();

        d.y += d.speed;
        d.x -= d.drift;
        if (d.y > h + 30 || d.x < -20) Object.assign(d, spawn(false));
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[3]"
    />
  );
}
