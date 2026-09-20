import { SignUp } from "@clerk/react-router";
import { clerkAppearance } from "@/components/ClerkSignInCard";
import { NotebookPen } from "lucide-react";
import { Suspense } from "react";
import { useNavigate } from "react-router";

/**
 * Clerk's prebuilt <SignUp> — email registration, themed to match
 * the notebook palette via the shared clerkAppearance. On success Clerk
 * redirects to /dashboard (forceRedirectUrl).
 */
function SignUpInner() {
  const navigate = useNavigate();

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
              Create your Cerevyn
            </h1>
            <p className="annotation text-sm">
              sign up — start earning XP today
            </p>
          </div>

          <div className="paper-sheet relative px-2 py-2 sm:px-3 sm:py-3">
            <SignUp
              signInUrl="/auth"
              fallbackRedirectUrl="/dashboard"
              appearance={clerkAppearance}
            />
          </div>

          <div className="mt-5 text-center">
            <a
              href="/auth"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Already have an account? Sign in
            </a>
          </div>
        </div>
      </div>
      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Secured by Clerk · email sign-in
      </footer>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpInner />
    </Suspense>
  );
}
