import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { NativeAuthBridge, SsoCallback } from "@/components/NativeAuthBridge";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { SettingsProvider } from "@/hooks/use-settings";
import { isNative } from "@/lib/native";
import { createNativeOAuthTransport } from "@/lib/native-oauth";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { LoadingScreen } from "@/components/loading";
import { Button } from "@/components/ui/button";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const SignUpPage = lazy(() => import("./pages/SignUp.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const AiStudy = lazy(() => import("./pages/AiStudy.tsx"));
const Practice = lazy(() => import("./pages/Practice.tsx"));
const Timetable = lazy(() => import("./pages/Timetable.tsx"));
const Quests = lazy(() => import("./pages/Quests.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const WeeklyReport = lazy(() => import("./pages/WeeklyReport.tsx"));
const EssayWriter = lazy(() => import("./pages/EssayWriter.tsx"));
const ProjectCreator = lazy(() => import("./pages/ProjectCreator.tsx"));
const Arcade = lazy(() => import("./pages/Arcade.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Flashcards = lazy(() => import("./pages/Flashcards.tsx"));
const Revision = lazy(() => import("./pages/Revision.tsx"));
const FocusMode = lazy(() => import("./pages/FocusMode.tsx"));
const Friends = lazy(() => import("./pages/Friends.tsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));
const Whiteboard = lazy(() => import("./pages/Whiteboard.tsx"));
const AdBannerController = lazy(() =>
  import("./components/AdBannerController").then((m) => ({
    default: m.AdBannerController,
  })),
);

// Route chunk loading — branded notebook, no layout jump
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingScreen message="opening your notebook…" />
    </div>
  );
}

/** Route-level error boundary — a failed lazy chunk or render error now shows
 *  a friendly retry screen instead of a blank page or the raw crash UI. */
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; key: number }
> {
  state = { hasError: false, key: 0 };
  static getDerivedStateFromError() {
    return { hasError: true, key: 0 };
  }
  componentDidCatch(err: Error) {
    console.error("[Cerevyn] Route error:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <RouteErrorFallback
          onRetry={() =>
            this.setState((s) => ({ hasError: false, key: s.key + 1 }))
          }
        />
      );
    }
    // key remount gives the boundary a fresh attempt on retry
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function MissingClerkKey() {
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

const clerkKeyRaw = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

// Env values pasted into platform key UIs sometimes arrive wrapped in
// quotes or with stray whitespace/newlines — even embedded mid-string —
// which makes Clerk's base64 decode of the key fail entirely (symptom:
// it tries to load clerk-js from "https:///npm/..." with no host).
// Publishable keys never contain whitespace or quotes, so strip them all.
const clerkKey = clerkKeyRaw ? clerkKeyRaw.replace(/[\s"']+/g, "") : undefined;

/** Log (never block) when the key doesn't look like a Clerk publishable
 *  key. An over-strict local validator previously hard-blocked a VALID key
 *  with an "invalid" screen, so validation here is advisory only — Clerk
 *  remains the real validator at bootstrap. */
const clerkKeyLooksSuspicious =
  !!clerkKey && !/^pk_(test|live)_/.test(clerkKey);
if (clerkKeyLooksSuspicious) {
  console.warn(
    "[Cerevyn] VITE_CLERK_PUBLISHABLE_KEY does not start with pk_test_/pk_live_ — " +
      "sign-in may fail. Still attempting Clerk bootstrap.",
  );
}

// On Android, route Clerk OAuth through the system browser with the
// `studynotebook://sso-callback` deep link (see src/lib/native-oauth.ts).
// Web builds keep Clerk's normal same-document redirect flow.
const clerkProviderProps = isNative()
  ? ({ __internal_oauthTransport: createNativeOAuthTransport() } as const)
  : {};

const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorBackground: "var(--card)",
    colorTextForeground: "var(--foreground)",
    colorInputBackground: "var(--paper)",
    colorInputBorder: "var(--border)",
    colorDanger: "var(--destructive)",
    borderRadius: "0.55rem",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "border shadow-[0_8px_24px_-12px_rgb(0_0_0/0.12)]",
    socialButtonsBlockButton: "border",
  },
} as const;

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Whole authenticated provider tree, kept as one component so it can be
 *  skipped cleanly when the Clerk key is missing (see MissingClerkKey). */
function AuthRoot() {
  if (!clerkKey) return <MissingClerkKey />;
  return (
    <ClerkProvider
      publishableKey={clerkKey}
      appearance={clerkAppearance}
      {...clerkProviderProps}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <SettingsProvider>
          <NativeAuthBridge />
          <RouteSyncer />
          <AdBannerController />
          <RouteErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                {/* Wildcard so Clerk's multi-step child paths
                    (/auth/factor-one, /auth/verify, /sign-up/verify-email-address, …)
                    render the same Clerk component instead of hitting NotFound. */}
                <Route
                  path="/auth/*"
                  element={<AuthPage redirectAfterAuth="/dashboard" />}
                />
                <Route path="/sign-up/*" element={<SignUpPage />} />
                <Route path="/sso-callback" element={<SsoCallback />} />
                {/* Clerk's <SignIn> (path-based routing at /auth) builds its
                    OAuth callback URL as signInPath + "/sso-callback", i.e.
                    /auth/sso-callback — this route must exist or Clerk
                    email-verification/native redirects land on NotFound.
                    Kept even with Google removed. */}
                <Route path="/auth/sso-callback" element={<SsoCallback />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/ai-study"
                  element={
                    <RequireAuth>
                      <AiStudy />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/practice"
                  element={
                    <RequireAuth>
                      <Practice />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/timetable"
                  element={
                    <RequireAuth>
                      <Timetable />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/quests"
                  element={
                    <RequireAuth>
                      <Quests />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/leaderboard"
                  element={
                    <RequireAuth>
                      <Leaderboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/weekly-report"
                  element={
                    <RequireAuth>
                      <WeeklyReport />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/essay"
                  element={
                    <RequireAuth>
                      <EssayWriter />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <RequireAuth>
                      <ProjectCreator />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/arcade"
                  element={
                    <RequireAuth>
                      <Arcade />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/flashcards"
                  element={
                    <RequireAuth>
                      <Flashcards />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/revision"
                  element={
                    <RequireAuth>
                      <Revision />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/focus"
                  element={
                    <RequireAuth>
                      <FocusMode />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/friends"
                  element={
                    <RequireAuth>
                      <Friends />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/whiteboard"
                  element={
                    <RequireAuth>
                      <Whiteboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <AdminPanel />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
          <Toaster />
        </SettingsProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      {/* Floating debug/inspector widget — never on native Android or
          production web builds; only inside the dev preview environment. */}
      {!isNative() && import.meta.env.DEV && (
        <ToolbarErrorBoundary>
          <VlyToolbar />
        </ToolbarErrorBoundary>
      )}
      <BrowserRouter>
        <AuthRoot />
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
