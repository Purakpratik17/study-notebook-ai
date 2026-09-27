import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppShell } from "./AppShell";
import { LoadingScreen } from "./loading";

/**
 * Route guard for authenticated pages (post-Clerk removal).
 *
 * Auth is Convex Auth's Anonymous provider: ConvexAuthProvider establishes a
 * persistent anonymous session per device, and useConvexAuth() turns true
 * once it's validated. Convex queries in children are guaranteed to run
 * with an authenticated identity — all backend authorization checks remain
 * fully intact.
 *
 * Bounded wait: if the session takes unusually long to establish (offline,
 * backend hiccup), show a friendly retry screen instead of spinning forever.
 */
const AUTH_TIMEOUT_MS = 12_000;

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const t = window.setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
      return () => window.clearTimeout(t);
    }
    setTimedOut(false);
  }, [isLoading]);

  if (isLoading && !timedOut) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <LoadingScreen message="warming up your notebook…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // The anonymous session should establish automatically; reaching this
    // state means the backend is unreachable. Offer a retry rather than a
    // dead end.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="font-bold">Having trouble reaching your notebook</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We couldn&apos;t set up your local study session. This is usually a
            temporary network issue — check your connection and try again.
          </p>
          <button
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // Authenticated pages render inside the app shell (nav + tab backgrounds).
  return <AppShell>{children}</AppShell>;
}
