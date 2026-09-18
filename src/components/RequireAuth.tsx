import { useAuth } from "@clerk/react-router";
import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { AppShell } from "./AppShell";
import { LoadingScreen } from "@/components/loading";

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
        <LoadingScreen message="checking your notebook…" />
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

  // Authenticated pages render inside the app shell (nav + tab backgrounds).
  return <AppShell>{children}</AppShell>;
}
