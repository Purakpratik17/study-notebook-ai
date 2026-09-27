import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import { SettingsProvider } from "@/hooks/use-settings";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { LoadingScreen } from "@/components/loading";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
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

/**
 * Auth model (post-Clerk removal):
 *
 * The app uses Convex Auth's Anonymous provider (configured in
 * src/convex/auth.ts — unchanged, still READ ONLY). ConvexAuthProvider
 * establishes a persistent anonymous session per device on first load, so
 * every user still gets a real Convex identity (identity.subject) and ALL
 * backend authorization checks (requireUserId etc.) keep working exactly as
 * before. No sign-in screen is shown; no data is exposed publicly.
 *
 * When the new Clerk application is integrated later, the Clerk provider
 * can be layered back in alongside this one without touching the data model.
 */
function AuthRoot() {
  return (
    <ConvexAuthProvider client={convex}>
      <SettingsProvider>
        <AdBannerController />
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
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
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      {/* Floating debug/inspector widget — never in production builds. */}
      {import.meta.env.DEV && (
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
