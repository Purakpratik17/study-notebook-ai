import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/react-router";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import { SettingsProvider } from "@/hooks/use-settings";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { LoadingScreen } from "@/components/loading";
import { MissingClerkKey } from "@/components/MissingClerkKey";
import { ClerkSignInCard } from "@/components/ClerkSignInCard";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
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
const Library = lazy(() => import("./pages/Library.tsx"));
const MyNotesPage = lazy(() => import("./pages/MyNotes.tsx"));
const AiNoteEditorPage = lazy(() => import("./pages/AiNoteEditor.tsx"));
const SharedPage = lazy(() => import("./pages/Shared.tsx"));
const AdBannerController = lazy(() =>
  import("./components/AdBannerController").then((m) => ({
    default: m.AdBannerController,
  })),
);
// Public legal pages (no auth — linked from sign-up, Settings, footer)
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy.tsx"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService.tsx"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy.tsx"));
const TrackingPolicy = lazy(() => import("./pages/legal/TrackingPolicy.tsx"));

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

// ─── Clerk publishable key (NEW application: tough-mouse-8027) ──────────────
// Env values pasted into platform key UIs sometimes arrive wrapped in
// quotes or with stray whitespace/newlines — even embedded mid-string —
// which makes Clerk's base64 decode of the key fail entirely. Publishable
// keys never contain whitespace or quotes, so strip them all.
const clerkKeyRaw = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const sanitized = clerkKeyRaw
  ? clerkKeyRaw.replace(/[\s"']+/g, "")
  : undefined;
// The publishable key is public by design, so a code fallback is safe. This
// rescues the app when the env slot is empty OR was filled with the SECRET
// key (sk_test_…) — a secret key decodes to no Clerk frontend API domain,
// which makes Clerk build a script URL like "https:///npm/..." and crash.
const FALLBACK_PUBLISHABLE_KEY =
  "pk_test_dG91Z2gtbW91c2UtODAyNy5jbGVyay5hY2NvdW50cy5kZXYk";
const clerkKey = sanitized?.startsWith("pk_") ? sanitized : FALLBACK_PUBLISHABLE_KEY;

/**
 * Provider tree. Clerk is the identity provider (new "tough-mouse-8027"
 * application); Convex validates the Clerk JWT via the "convex" token
 * template. All Freebuff features, routes and styling are unchanged.
 *
 * If the key is missing, a clear actionable screen renders instead of a
 * cryptic Clerk bootstrap crash.
 */
function AuthRoot() {
  if (!clerkKey) return <MissingClerkKey />;
  return (
    <ClerkProvider publishableKey={clerkKey} appearance={{}}>
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <SettingsProvider>
          <AdBannerController />
          <RouteErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/tracking" element={<TrackingPolicy />} />
                <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
                <Route path="/my-notes" element={<RequireAuth><MyNotesPage /></RequireAuth>} />
                <Route path="/ai-notes/:noteId" element={<RequireAuth><AiNoteEditorPage /></RequireAuth>} />
                <Route path="/shared" element={<RequireAuth><SharedPage /></RequireAuth>} />
                <Route
                  path="/auth/*"
                  element={<AuthPage redirectAfterAuth="/dashboard" />}
                />
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
