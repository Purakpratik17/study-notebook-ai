import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/loading";

/* ═══════════════════════════════════════════════════════════════════════
   AuthGate — bounded wait for Clerk session initialization.

   Clerk's `isLoaded` only flips true after its session network calls to
   the Clerk frontend API complete. If those requests hang or fail
   silently (transient network outage, blocked request inside the preview
   iframe, Clerk downtime), `isLoaded` stays false forever and the app
   would sit on the branded splash indefinitely.

   AuthGate shows the normal splash, but after AUTH_TIMEOUT_MS it switches
   to a friendly error state with a Retry button (full reload re-runs the
   Clerk bootstrap). Once Clerk resolves, children render immediately.
   ═══════════════════════════════════════════════════════════════════════ */

const AUTH_TIMEOUT_MS = 12_000;

export function AuthGate({
  ready,
  children,
}: {
  /** True once the auth provider has finished initializing. */
  ready: boolean;
  children?: React.ReactNode;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (ready) return <>{children}</>;

  if (timedOut) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="font-bold">Having trouble reaching your notebook</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We couldn&apos;t load your sign-in session. This is usually a
            temporary network issue — check your connection and try again.
          </p>
          <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <LoadingScreen message="warming up your notebook…" />
    </div>
  );
}
