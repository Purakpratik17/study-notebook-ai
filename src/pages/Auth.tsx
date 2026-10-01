import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ClerkSignInCard } from "@/components/ClerkSignInCard";
import { NotebookPen } from "lucide-react";
import { Suspense, useEffect } from "react";
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
  const { isLoading, isAuthenticated, name } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

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

          {isLoading ? (
            <div className="paper-sheet flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="annotation mt-1 text-sm">
                opening your notebook…
              </p>
            </div>
          ) : isAuthenticated ? (
            <div className="paper-sheet flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <div>
                <p className="text-sm font-semibold">Signed in as {name}</p>
                <p className="annotation mt-1 text-sm">
                  opening your notebook…
                </p>
              </div>
            </div>
          ) : (
            <ClerkSignInCard />
          )}

          <div className="mt-5 text-center">
            <Button asChild variant="ghost" className="text-muted-foreground">
              <a href="/">← Back to landing page</a>
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </a>{" "}
            and acknowledge our{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
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
