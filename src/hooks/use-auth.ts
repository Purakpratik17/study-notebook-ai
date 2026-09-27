import { useConvexAuth } from "convex/react";

/**
 * Auth surface (post-Clerk removal).
 *
 * Authentication is now Convex Auth's Anonymous provider: every device gets
 * a persistent Convex identity automatically (no sign-in screen). All study
 * data remains keyed on the Convex identity's `subject` claim — exactly the
 * same id shape the backend's requireUserId() returns — so existing data
 * isolation and authorization are unchanged.
 *
 * The fields Clerk used to fill (name/email/image) are null for anonymous
 * sessions; UI that displays them falls back to defaults. When the new
 * Clerk application is integrated later, this hook is the single place to
 * re-attach richer identity info.
 */
export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return {
    isLoading,
    isAuthenticated,
    clerkUser: null, // legacy field — no Clerk user anymore
    userId: null,
    name: "Student",
    imageUrl: undefined,
    email: null,
  };
}

/** Sign-out is a no-op for anonymous sessions (kept so callers don't break). */
export function useClerkSignOut() {
  return () => Promise.resolve();
}
