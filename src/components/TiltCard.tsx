import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   TILT CARD — gentle 3D perspective tilt toward the cursor (desktop).

   • Pointer tracking only activates on fine pointers (mouse/trackpad).
     Touch devices get the pure-CSS .card-3d lift/press instead — zero
     scroll or tap interference on Android.
   • Transform/opacity only: GPU-friendly, no layout work, no WebGL,
     no new dependencies.
   • Disabled automatically by prefers-reduced-motion and the app's own
     animations setting ([data-animations="off"]).
   • Purely presentational — wraps content, never intercepts clicks.
   ═══════════════════════════════════════════════════════════════════════ */

export function TiltCard({
  children,
  className,
  maxTilt = 6,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees — keep small for elegance. */
  maxTilt?: number;
  style?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const finePointer = useRef(false);

  useEffect(() => {
    finePointer.current = window.matchMedia("(pointer: fine)").matches;
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!finePointer.current || e.pointerType !== "mouse") return;
      if (document.documentElement.dataset.animations === "off") return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ rx: -py * maxTilt * 2, ry: px * maxTilt * 2 });
    },
    [maxTilt],
  );

  const onLeave = useCallback(() => setTilt(null), []);

  const cssVars: CSSProperties = tilt
    ? ({
        "--tilt-rx": `${tilt.rx}deg`,
        "--tilt-ry": `${tilt.ry}deg`,
      } as CSSProperties)
    : {};

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("card-3d", tilt !== null && "card-3d--tilting", className)}
      style={{ ...cssVars, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
