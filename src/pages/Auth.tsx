import { Button } from "@/components/ui/button";
import { useAuth, useClerkSignOut } from "@/hooks/use-auth";
import { ClerkSignInCard } from "@/components/ClerkSignInCard";
import { NotebookPen } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading, isAuthenticated, clerkUser, name } = useAuth();
  const signOut = useClerkSignOut();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const clerkSignedIn = Boolean(clerkUser);
  // Clerk has authenticated the user, but Convex is still validating the
  // Clerk JWT (useConvexAuth). Show an explicit completing-state instead of
  // Clerk's transparent already-signed-in SignIn — this is the transient
  // state right after returning from Google/email before the app takes over.
  const completingSignIn = !isLoading && clerkSignedIn && !isAuthenticated;

  // If Convex never validates the Clerk JWT (e.g. the Clerk instance is
  // missing the built-in "convex" JWT template, which ConvexProviderWithClerk
  // requests with getToken({ template: "convex" })), surface the failure
  // after a grace period instead of spinning forever.
  const [convexStalled, setConvexStalled] = useState(false);
  const startedAt = useRef<number>(0);
  useEffect(() => {
    if (!completingSignIn) {
      setConvexStalled(false);
      return;
    }
    startedAt.current = Date.now();
    const t = setTimeout(() => {
      // Only flag a stall if still not authenticated after the grace period.
      setConvexStalled(Date.now() - startedAt.current >= 12000);
    }, 12000);
    return () => clearTimeout(t);
  }, [completingSignIn]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, redirect]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <button
              onClick={() => navigate("/")}
              aria-label="Back to home"
              className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition hover:scale-105"
            >
              <NotebookPen className="size-6" />
            </button>
            <h1 className="text-xl font-bold tracking-tight">
              Welcome to Cerevyn
            </h1>
            <p className="annotation text-sm">
              sign in — your XP is waiting
            </p>
          </div>

          {completingSignIn ? (
            <div className="paper-sheet flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <div>
                <p className="text-sm font-semibold">Signed in as {name}</p>
                {convexStalled ? (
                  <>
                    <p className="mt-1 text-sm font-medium text-destructive">
                      Couldn't connect to your notebook's backend.
                    </p>
                    <p className="annotation mt-1 text-xs">
                      check your connection and retry — or try again later
                    </p>
                  </>
                ) : (
                  <p className="annotation mt-1 text-sm">
                    opening your notebook…
                  </p>
                )}
              </div>
              {convexStalled ? (
                <Button size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => void signOut()}
              >
                Use a different account
              </Button>
            </div>
          ) : (
            <ClerkSignInCard />
          )}

          <div className="mt-5 text-center">
            <Button asChild variant="ghost" className="text-muted-foreground">
              <a href="/">← Back to landing page</a>
            </Button>
          </div>
        </div>
      </div>
      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Secured by Clerk · email sign-in
      </footer>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
