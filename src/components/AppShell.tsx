import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TabBackground } from "@/components/TabBackground";
import { useAuth, useClerkSignOut } from "@/hooks/use-auth";
import { useSounds } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  FileStack,
  Gamepad2,
  Home,
  Layers,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  Palette,
  PenLine,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Swords,
  Target,
  Timer as TimerIcon,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
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
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/** Mobile bottom bar keeps the 4 highest-traffic destinations; the rest
 *  live in a compact "More" sheet so nothing feels overcrowded. */
const MOBILE_TABS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/ai-study", label: "AI Study", icon: Sparkles },
  { to: "/quests", label: "Quests", icon: Swords },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
] as const;

const MORE_TABS = [
  { to: "/essay", label: "Essay Writer", icon: PenLine },
  { to: "/projects", label: "Projects", icon: FileStack },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/revision", label: "Revision", icon: RefreshCw },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/focus", label: "Focus", icon: TimerIcon },
  { to: "/whiteboard", label: "Whiteboard", icon: Palette },
] as const;

const MORE_SOCIAL = [
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function MoreGroup({
  title,
  tabs,
  pathname,
}: {
  title: string;
  tabs: ReadonlyArray<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  pathname: string;
}) {
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
        {title}
      </p>
      <div className="flex flex-col">
        {tabs.map((tab) => {
          const active = pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground",
                active ? "bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              <tab.icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { name, imageUrl } = useAuth();
  const signOut = useClerkSignOut();
  const sounds = useSounds();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore =
    MORE_TABS.some((t) => location.pathname === t.to) ||
    MORE_SOCIAL.some((t) => location.pathname === t.to);
  // Global Whiteboard drawer — hidden/collapsed by default so it never takes
  // space in the normal study UI. Opens as a smooth bottom sheet; the editor
  // itself can go fullscreen from inside.
  const [wbOpen, setWbOpen] = useState(false);
  // Admin nav visibility is COSMETIC ONLY — the Convex backend re-checks
  // the allowlist on every admin call (src/convex/admin.ts).
  const isAdmin = useQuery(api.admin.isAdmin) === true;

  // Close the "More" sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
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
            <span className="annotation text-[11px]">ai study companion</span>
          </span>
        </Link>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {TABS.map((tab) => {
            const active =
              location.pathname === tab.to ||
              (tab.to === "/ai-study" &&
                location.pathname.startsWith("/ai-study"));
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                onClick={sounds.click}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-primary/10 font-semibold text-primary",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </NavLink>
            );
          })}
          <NavLink
            to="/arcade"
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              location.pathname === "/arcade" &&
                "bg-primary/10 font-semibold text-primary",
            )}
          >
            <Gamepad2 className="size-4" />
            Arcade
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                location.pathname === "/admin" &&
                  "bg-primary/10 font-semibold text-primary",
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

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">
            Cerevyn
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link to="/profile" aria-label="Profile">
              <User className="size-4" />
            </Link>
          </Button>
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
      </header>

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

      {/* Page content */}
      <main className="overflow-x-hidden px-4 pb-28 pt-5 md:ml-60 md:px-8 md:pb-12 md:pt-8">
        <TabBackground />
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom navigation: 4 primary tabs + More sheet */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = location.pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <tab.icon className={cn("size-5", active && "scale-110")} />
                {tab.label}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
              (moreOpen || inMore) && "text-primary",
            )}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
        {moreOpen && (
          <div className="max-h-[60dvh] overflow-y-auto overscroll-contain border-t bg-card px-3 py-3">
            <MoreGroup
              title="Study"
              tabs={[
                { to: "/practice", label: "Practice", icon: Target },
                { to: "/arcade", label: "Arcade", icon: Gamepad2 },
                ...MORE_TABS,
              ]}
              pathname={location.pathname}
            />
            <MoreGroup title="You" tabs={MORE_SOCIAL} pathname={location.pathname} />
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground",
                  location.pathname === "/admin"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent",
                )}
              >
                <ShieldCheck className="size-4" /> Admin
              </Link>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
