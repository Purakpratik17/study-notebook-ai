import { useConvexAuth } from "convex/react";
import { useUser, useClerk } from "@clerk/react-router";

/**
 * Auth surface for the Cerevyn app.
 *
 * Authentication is Clerk-issued (new "tough-mouse-8027" application).
 * Convex functions key all study data on the Clerk identity's `sub` claim
 * (identity.subject); this hook exposes display data for the UI.
 *
 * `isAuthenticated` combines BOTH gates: Clerk must have an active session
 * AND Convex must have validated the Clerk JWT. Backend data access keys
 * off the Clerk identity subject, so data isolation is unchanged.
 */
export function useAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated: convexAuthed } = useConvexAuth();

  const name =
    user?.firstName ??
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    "Student";

  return {
    isLoading: !isLoaded,
    isAuthenticated: Boolean(isSignedIn && convexAuthed),
    clerkUser: user,
    userId: user?.id ?? null,
    name,
    imageUrl: user?.imageUrl,
    email:
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      null,
  };
}

export function useClerkSignOut() {
  const clerk = useClerk();
  return () => clerk.signOut({ redirectUrl: "/" });
}
