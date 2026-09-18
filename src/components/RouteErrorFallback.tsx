import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shown when a route fails to load (e.g. a stale chunk 404 after a deploy).
 *  A single tap reloads with a fresh cache-busted location — no blank screen. */
export function RouteErrorFallback({ onRetry }: { onRetry: () => void }) {
  useEffect(() => {
    console.error("[Learnova] A screen failed to load. Use retry.");
  }, []);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-4xl">📕</span>
      <div>
        <p className="font-bold">This page didn't load properly</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Your connection may have dropped while fetching the page. Retrying
          usually fixes it.
        </p>
      </div>
      <Button onClick={onRetry} className="min-h-11 px-6">
        Try again
      </Button>
    </div>
  );
}
