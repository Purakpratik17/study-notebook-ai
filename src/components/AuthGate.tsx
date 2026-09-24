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

/** Human-readable hint appended based on how long Clerk has been stuck. */
function failureHint(attempt: number): string {
  if (attempt >= 2) {
    return (
      "Still failing after " +
      attempt +
      " attempts. The sign-in key for this environment may be missing or misconfigured — check that the Clerk publishable key is set in this environment's API keys settings."
    );
  }
  return (
    "If this keeps happening, the sign-in service may be unreachable from " +
    "this network, or this environment may be missing its sign-in key."
  );
}

export function AuthGate({
  ready,
  children,
}: {
  /** True once the auth provider has finished initializing. */
  ready: boolean;
  children?: React.ReactNode;
}) {
  const [timedOut, setTimedOut] = useState(false);
  // Persisted across reloads (Retry does a full page load) so the error hint
  // can escalate after repeated failures.
  const [attempt, setAttempt] = useState(() => {
    try {
      return Number(window.sessionStorage.getItem("cerevyn:auth-retries")) || 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    if (ready) {
      // Success — clear the retry counter for next time.
      try {
        window.sessionStorage.removeItem("cerevyn:auth-retries");
      } catch {
        // ignore
      }
      return;
    }
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
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
            {failureHint(attempt)}
          </p>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              try {
                window.sessionStorage.setItem(
                  "cerevyn:auth-retries",
                  String(attempt + 1),
                );
              } catch {
                // storage unavailable — hint just won't escalate
              }
              window.location.reload();
            }}
          >
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
