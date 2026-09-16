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
const EssayWriter = lazy(() => import("./pages/EssayWriter.tsx"));
const ProjectCreator = lazy(() => import("./pages/ProjectCreator.tsx"));
const Arcade = lazy(() => import("./pages/Arcade.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <BrowserRouter>
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
          appearance={clerkAppearance}
        >
          <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
            <NativeAuthBridge />
            <RouteSyncer />
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <Toaster />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
