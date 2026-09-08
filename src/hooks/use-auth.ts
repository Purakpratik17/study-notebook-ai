import { useUser, useClerk } from "@clerk/react-router";
import { useConvexAuth } from "convex/react";

/**
 * Auth is Clerk-issued. Convex functions key all study data on the Clerk
 * identity's `sub` claim; this hook exposes display data for the UI.
 */
export function useAuth() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { isAuthenticated } = useConvexAuth();

  const name =
    user?.firstName ??
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ??
    "Student";

  return {
    isLoading: !isLoaded,
    isAuthenticated: Boolean(isSignedIn && isAuthenticated),
    clerkUser: user,
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
