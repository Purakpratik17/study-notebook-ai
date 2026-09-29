import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TabBackground } from "@/components/TabBackground";
import { useAuth, useClerkSignOut } from "@/hooks/use-auth";
import { useSounds } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Ellipsis,
  FileStack,
  FolderOpen,
  Gamepad2,
  Home,
  Inbox,
  Layers,
  LogOut,
  MessageCircle,
  NotebookPen,
  Palette,
  PenLine,
  RefreshCw,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Swords,
  Target,
  Timer as TimerIcon,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useBannerMargin } from "@/hooks/use-banner-margin";
import { lazy, Suspense, useEffect, useState } from "react";
import { AmbientDepth } from "@/components/AmbientDepth";
import { Link, NavLink, useLocation } from "react-router";
import { ChevronLeft, X } from "lucide-react";

const Whiteboard = lazy(() => import("@/pages/Whiteboard"));
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldCheck } from "lucide-react";

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/ai-study", label: "AI Study", icon: Sparkles },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/essay", label: "Essay Writer", icon: PenLine },
  { to: "/projects", label: "Projects", icon: FileStack },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/revision", label: "Revision", icon: RefreshCw },
  { to: "/focus", label: "Focus", icon: TimerIcon },
  { to: "/whiteboard", label: "Whiteboard", icon: Palette },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/quests", label: "Quests", icon: Swords },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/weekly-report", label: "Weekly Report", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/** Mobile bottom bar: 5 primary destinations. Everything else lives in
 *  the "More" sheet so nothing is lost. */
const BOTTOM_TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/ai-study", label: "Notes", icon: Sparkles },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/timetable", label: "Planner", icon: CalendarDays },
] as const;

const MORE_TABS = [
  { to: "/essay", label: "Essay Writer", icon: PenLine },
  { to: "/projects", label: "Projects", icon: FileStack },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/revision", label: "Revision", icon: RefreshCw },
  { to: "/focus", label: "Focus", icon: TimerIcon },
] as const;

/* ─── Sectioned navigation (desktop sidebar + mobile More sheet) ────── */

const SECTION_STUDY = [
  { to: "/ai-study", label: "AI Notes", icon: Sparkles },
  { to: "/my-notes", label: "My Notes", icon: NotebookPen },
  { to: "/whiteboard", label: "Whiteboards", icon: Palette },
  { to: "/ai-study", label: "Quizzes", icon: Target },
  { to: "/library", label: "Folders & Library", icon: FolderOpen },
] as const;

const SECTION_SOCIAL = [
  { to: "/friends", label: "Friends & Chats", icon: Users },
  { to: "/friends", label: "Friend Requests", icon: MessageCircle },
  { to: "/shared", label: "Shared With Me", icon: Inbox },
  { to: "/shared", label: "Shared By Me", icon: Send },
] as const;

const SECTION_LEARNING = [
  { to: "/ai-study", label: "AI Study Generator", icon: Sparkles },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/timetable", label: "Study Planner", icon: CalendarDays },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/weekly-report", label: "Progress Dashboard", icon: BarChart3 },
] as const;

const SECTION_EXTRAS = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/essay", label: "Essay Writer", icon: PenLine },
  { to: "/projects", label: "Projects", icon: FileStack },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/revision", label: "Revision", icon: RefreshCw },
  { to: "/focus", label: "Focus", icon: TimerIcon },
  { to: "/quests", label: "Quests", icon: Swords },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

// Every sectioned route — used to highlight the More button on mobile.
const ALL_SECTION_TABS = [
  ...SECTION_STUDY,
  ...SECTION_SOCIAL,
  ...SECTION_LEARNING,
  ...SECTION_EXTRAS,
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { name, imageUrl } = useAuth();
  const signOut = useClerkSignOut();
  const sounds = useSounds();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = ALL_SECTION_TABS.some((t) => location.pathname === t.to);
  // Global Whiteboard drawer — hidden/collapsed by default so it never takes
  // space in the normal study UI. Opens as a smooth bottom sheet; the editor
  // itself can go fullscreen from inside.
  const [wbOpen, setWbOpen] = useState(false);
  // Native Android banner occupies the very bottom of the screen — reserve
  // real layout space for it so it can never cover the bottom nav.
  const bannerMargin = useBannerMargin();
  // Admin nav visibility is COSMETIC ONLY — the Convex backend re-checks
  // the allowlist on every admin call (src/convex/admin.ts).
  const isAdmin = useQuery(api.admin.isAdmin) === true;

  // Close the "More" sheet whenever the route changes.
  useEffect(() => {
    const t = window.setTimeout(() => setMoreOpen(false), 0);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        // Respect punch-hole / rounded corners on the sides too.
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur md:flex">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <NotebookPen className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight">
              Cerevyn
            </span>
            <span className="annotation text-[11px]">learn • play • level up</span>
          </span>
        </Link>

        <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {(
            [
              { title: "Study Space", tabs: SECTION_STUDY },
              { title: "Social", tabs: SECTION_SOCIAL },
              { title: "Learning", tabs: SECTION_LEARNING },
            ] as const
          ).map((section) => (
            <div key={section.title} className="mb-1">
              <details open className="group/section">
                <summary className="flex cursor-pointer list-none items-center gap-1 px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground">
                  {section.title}
                  <ChevronDown className="ml-auto size-3 transition-transform group-open/section:rotate-180" />
                </summary>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {section.tabs.map((tab, i) => (
                    <NavLink
                      key={`${tab.to}-${i}`}
                      to={tab.to}
                      onClick={sounds.click}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        location.pathname === tab.to &&
                          "bg-primary/10 font-semibold text-primary nav-elevated",
                      )}
                    >
                      <tab.icon className="size-4" />
                      {tab.label}
                    </NavLink>
                  ))}
                </div>
              </details>
            </div>
          ))}
          <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
            More
          </p>
          {SECTION_EXTRAS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={sounds.click}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                location.pathname === tab.to &&
                  "bg-primary/10 font-semibold text-primary nav-elevated",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                location.pathname === "/admin" &&
                  "bg-primary/10 font-semibold text-primary nav-elevated",
              )}
            >
              <ShieldCheck className="size-4" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-3 px-4 pb-5">
          <div className="rounded-lg border bg-card/70 p-3">
            <p className="annotation text-xs">keep the streak alive!</p>
            <Link
              to="/quests"
              className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Swords className="size-3.5" /> View daily quests
            </Link>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border bg-card/70 p-2.5">
            <Avatar className="size-9 border">
              <AvatarImage src={imageUrl} alt={name} />
              <AvatarFallback className="bg-highlight-soft text-sm font-bold text-foreground">
                {name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">Keep studying!</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — branding + profile; navigation lives in the
          bottom nav below (native-app pattern). */}
      <header style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/85 px-4 py-2.5 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <NotebookPen className="size-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold tracking-tight">Cerevyn</span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              learn • play • level up
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link to="/profile" aria-label="Profile">
              <User className="size-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      {/* Mobile bottom navigation — blurred, 5 items. */}
      <nav
        className={cn(
          "bottom-nav md:hidden",
          bannerMargin ? "bottom-16" : "bottom-0",
        )}
        aria-label="Primary"
      >
        <div className="mx-auto flex w-full max-w-md items-stretch px-2">
          {BOTTOM_TABS.map((tab) => {
            const active =
              location.pathname === tab.to ||
              (tab.to === "/ai-study" &&
                location.pathname.startsWith("/ai-study"));
            return (
              <Link
                key={tab.to}
                to={tab.to}
                onClick={sounds.click}
                className={cn("bottom-nav-item", active && "active")}
                aria-current={active ? "page" : undefined}
              >
                <span className="bottom-nav-icon">
                  <tab.icon className="size-5" />
                </span>
                {tab.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              sounds.click();
              setMoreOpen((v) => !v);
            }}
            aria-expanded={moreOpen}
            className={cn("bottom-nav-item", inMore && "active")}
          >
            <span className="bottom-nav-icon">
              <Ellipsis className="size-5" />
            </span>
            More
          </button>
        </div>
      </nav>

      {/* "More" bottom sheet — every remaining destination. */}
      {moreOpen && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/30 md:hidden"
          />
          <div
            role="dialog"
            aria-label="More navigation"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t bg-popover px-3 pt-3 shadow-2xl md:hidden"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
            {(
              [
                { title: "📚 Study Space", tabs: SECTION_STUDY },
                { title: "👥 Social", tabs: SECTION_SOCIAL },
                { title: "🎓 Learning", tabs: SECTION_LEARNING },
                { title: "✨ More", tabs: SECTION_EXTRAS },
              ] as const
            ).map((section) => (
              <div key={section.title} className="mb-2">
                <p className="annotation mb-1 px-1 text-[10px] font-bold uppercase tracking-wider">
                  {section.title}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {section.tabs.map((tab, i) => (
                    <Link
                      key={`${tab.to}-${i}`}
                      to={tab.to}
                      className={cn(
                        "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-[11px] font-semibold text-muted-foreground card-lift",
                        location.pathname === tab.to
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "bg-card",
                      )}
                    >
                      <tab.icon className="size-5" />
                      {tab.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground",
                  location.pathname === "/admin" ? "bg-primary/10 text-primary" : "bg-card",
                )}
              >
                <ShieldCheck className="size-4" /> Admin
              </Link>
            )}
            <button
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}
              className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </>
      )}

      {/* Global Whiteboard handle — a slim chevron on the right edge.
          Hidden while already inside the Whiteboard or Arcade (fullscreen-ish
          experiences) and on desktop, where the sidebar already links it. */}
      {!wbOpen &&
        location.pathname !== "/whiteboard" &&
        location.pathname !== "/arcade" && (
          <button
            onClick={() => {
              sounds.click();
              setWbOpen(true);
            }}
            aria-label="Open Whiteboard"
            className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-0.5 rounded-l-xl border border-r-0 bg-card/95 py-4 pl-2 pr-1.5 text-primary shadow-lg backdrop-blur transition-transform active:scale-95 md:hidden"
          >
            <Palette className="size-4" />
            <ChevronLeft className="size-4" />
          </button>
        )}

      {/* Whiteboard bottom-sheet drawer (smooth expand/collapse). */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 h-[78dvh] overflow-hidden rounded-t-2xl border-t bg-background shadow-2xl transition-transform duration-300 ease-out md:hidden",
          wbOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        aria-hidden={!wbOpen}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-bold">📝 Whiteboard</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setWbOpen(false)}
            aria-label="Close Whiteboard"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="h-[calc(100%-2.6rem)] overflow-y-auto overscroll-contain">
          {wbOpen && (
            <Suspense fallback={null}>
              <Whiteboard embedded />
            </Suspense>
          )}
        </div>
      </div>

      {/* Page content — bottom padding reserves space for the fixed nav. */}
      <main
        style={bannerMargin ? { marginBottom: 64 } : undefined}
        className="min-h-0 flex-1 overflow-x-hidden px-4 pb-28 pt-5 md:ml-60 md:px-8 md:pb-12 md:pt-8"
      >
        <TabBackground />
        <AmbientDepth />
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
