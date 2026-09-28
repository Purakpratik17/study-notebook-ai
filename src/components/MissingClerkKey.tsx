import { Button } from "@/components/ui/button";

/**
 * Rendered when VITE_CLERK_PUBLISHABLE_KEY is absent from the environment.
 * One clear actionable screen instead of a cryptic Clerk bootstrap crash.
 */
export function MissingClerkKey() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="font-bold">Sign-in is not configured</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The Clerk publishable key is missing from this environment. Add
          VITE_CLERK_PUBLISHABLE_KEY in the project&apos;s Keys/API keys
          settings, then reload the app.
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </main>
  );
}
