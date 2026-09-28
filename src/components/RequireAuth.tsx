import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { AppShell } from "./AppShell";
import { LoadingScreen } from "./loading";

/**
 * Route guard for authenticated pages.
 *
 * Auth is Clerk; useConvexAuth() (inside useAuth) only turns true once
 * Convex has validated the Clerk JWT, so Convex queries in children are
 * guaranteed to run with an authenticated identity — all backend
 * authorization checks remain fully intact.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <LoadingScreen message="warming up your notebook…" />
      </div>
    );
  }

  if (!isAuthenticated) {
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
