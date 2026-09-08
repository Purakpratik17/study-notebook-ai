import { useAuth } from "@clerk/react-router";
import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * Route guard for authenticated pages. Auth is Clerk; useConvexAuth() only
 * turns true once Convex has validated the Clerk JWT, so Convex queries in
 * children are guaranteed to run with an authenticated identity.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();

  if (!isLoaded || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="annotation text-sm">checking your notebook…</p>
        </div>
      </main>
    );
  }

  if (!isSignedIn || !isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
