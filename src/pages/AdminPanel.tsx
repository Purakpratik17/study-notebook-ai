import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  ClipboardList,
  Coins,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserSearch,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════
   Admin Panel — development/admin management (marked "Admin / Dev").

   SECURITY: visibility here is cosmetic. Every Convex function used by
   this page re-checks the caller's Clerk user ID against the allowlist
   in src/lib/admin-config.ts on the backend (see src/convex/admin.ts).
   A normal user who somehow reaches this page gets authorization errors
   from every call and sees no data.
   ═══════════════════════════════════════════════════════════════════════ */

type SearchResult = {
  userId: string;
  username: string;
  bio: string | null;
  school: string | null;
  course: string | null;
  xp: number;
  level: number;
  levelName: string;
};

export default function AdminPanel() {
  const [searchTerm, setSearchTerm] = useState(""); // committed search
  const isAdmin = useQuery(api.admin.isAdmin);
  const overview = useQuery(api.admin.overview);
  const audit = useQuery(api.admin.auditLog);
  const results = useQuery(
    api.admin.searchUsers,
    searchTerm.trim() ? { query: searchTerm } : "skip",
  );
  const adjustXp = useMutation(api.admin.adjustXp);
  const grantSub = useMutation(api.admin.grantSubscription);
  const removeSub = useMutation(api.admin.removeSubscription);
  const { userId: myClerkId } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [amount, setAmount] = useState("100");
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const patchSelected = (xp: number, level: number, levelName: string) =>
    setSelected((prev) => (prev ? { ...prev, xp, level, levelName } : prev));

  const run = async (
    action: "add" | "remove" | "set" | "reset",
    value?: number,
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await adjustXp({
        userId: selected.userId,
        action,
        amount: value,
      });
      patchSelected(r.newXp, r.level, r.levelName);
      if (action === "add") toast.success(`+${r.newXp - r.previousXp} XP`);
      else if (action === "remove")
        toast.success(`−${r.previousXp - r.newXp} XP`);
      else if (action === "set") toast.success(`XP set to ${r.newXp}`);
      else toast.success("XP reset to 0");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const doSearch = () => {
    if (!searchInput.trim()) return;
    setSearchTerm(searchInput.trim());
  };

  if (isAdmin === undefined) {
    return (
      <div className="paper-sheet flex items-center gap-3 px-5 py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="annotation text-sm">checking access…</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="paper-sheet flex flex-col items-center gap-3 px-6 py-14 text-center">
        <ShieldCheck className="size-10 text-destructive" />
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is restricted to Cerevyn administrators. If you believe
          you should have access, contact the app owner.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight">
          <ShieldCheck className="size-7 text-primary" /> Admin Panel
          <span className="rounded-full border border-dashed border-highlight/60 bg-highlight-soft/50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-foreground/70">
            Admin / Dev
          </span>
        </h1>
        <p className="annotation text-sm">
          user management · XP tools · audit log
        </p>
      </header>

      {/* Who am I — helps the owner copy their Clerk ID into the allowlist. */}
      {myClerkId && (
        <div className="rounded-lg border bg-card/70 px-4 py-3 text-sm">
          <p className="font-semibold">Your Clerk user ID</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {myClerkId}
          </p>
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3">
        <div className="paper-sheet px-4 py-4">
          <Users className="size-5 text-primary" />
          <p className="mt-2 text-2xl font-black tracking-tight">
            {overview === undefined ? "…" : overview.totalUsers}
          </p>
          <p className="annotation text-xs">Total users</p>
        </div>
        <div className="paper-sheet px-4 py-4">
          <ClipboardList className="size-5 text-primary" />
          <p className="mt-2 text-2xl font-black tracking-tight">
            {audit === undefined ? "…" : audit.length}
          </p>
          <p className="annotation text-xs">Recent admin actions</p>
        </div>
      </section>

      {overview !== undefined && overview.recent.length > 0 && (
        <section className="paper-sheet spiral-edge px-5 py-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Recent users
          </h2>
          <ul className="ruled-list mt-2 flex flex-col">
            {overview.recent.map((u) => (
              <li
                key={u.userId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-semibold">{u.username}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── User search ──────────────────────────────────────────────── */}
      <section className="paper-sheet spiral-edge px-5 py-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserSearch className="size-5 text-primary" /> Find a user
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
            placeholder="Search by username…"
            className="h-11 flex-1 rounded-lg border bg-background px-3 text-sm"
            aria-label="Search users by username"
          />
          <button
            onClick={doSearch}
            disabled={searchInput.trim().length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Search className="size-4" />
            Search
          </button>
        </div>

        {searchTerm && results !== undefined && results.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            No users match “{searchTerm}”.
          </p>
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {(results ?? []).map((u) => {
            const active = selected?.userId === u.userId;
            return (
              <li key={u.userId}>
                <button
                  onClick={() => {
                    setSelected(u);
                    setConfirmReset(false);
                  }}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "bg-card/70 hover:bg-accent"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{u.username}</span>
                    <span className="text-xs font-semibold text-xp">
                      {u.xp} XP · Lv {u.level} {u.levelName}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                    {u.userId}
                  </p>
                  {(u.school || u.course) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[u.school, u.course].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── XP management ────────────────────────────────────────────── */}
      {selected && (
        <section className="paper-sheet spiral-edge px-5 py-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Coins className="size-5 text-xp" /> XP management
          </h2>
          <p className="annotation mt-0.5 text-xs">
            target: <strong>{selected.username}</strong>
          </p>

          <div className="mt-3 rounded-lg border bg-card/70 px-4 py-3">
            <p className="text-sm text-muted-foreground">Current XP</p>
            <p className="text-2xl font-black text-xp">{selected.xp}</p>
            <p className="text-xs text-muted-foreground">
              Level {selected.level} · {selected.levelName}
            </p>
          </div>

          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-3 h-11 w-full rounded-lg border bg-background px-3 text-sm"
            aria-label="XP amount"
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              onClick={() => void run("add", Number(amount))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-xp/15 font-bold text-xp transition hover:bg-xp/25 disabled:opacity-50"
            >
              <Plus className="size-4" /> Add XP
            </button>
            <button
              disabled={busy}
              onClick={() => void run("remove", Number(amount))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive/10 font-bold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
            >
              <Minus className="size-4" /> Remove XP
            </button>
            <button
              disabled={busy}
              onClick={() => void run("set", Number(amount))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card font-bold transition hover:bg-accent disabled:opacity-50"
            >
              Set to amount
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmReset(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 font-bold text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
            >
              <RotateCcw className="size-4" /> Reset XP
            </button>
          </div>

          {confirmReset && (
            <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
              <p className="text-sm font-bold text-destructive">
                Reset XP for {selected.username}?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Their XP will permanently change from{" "}
                <strong>{selected.xp}</strong> to <strong>0</strong> and their
                rank will be recalculated.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => {
                    void run("reset");
                    setConfirmReset(false);
                  }}
                  className="h-10 flex-1 rounded-lg bg-destructive font-bold text-white transition hover:bg-destructive/90 disabled:opacity-50"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="h-10 flex-1 rounded-lg border bg-card font-bold transition hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Subscription management ──────────────────────────────── */}
      {selected && (
        <SubscriptionSection
          target={selected}
          grantSub={grantSub}
          removeSub={removeSub}
        />
      )}

      {/* ── Audit log ────────────────────────────────────────────────── */}
      <section className="paper-sheet spiral-edge px-5 py-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardList className="size-5 text-primary" /> Recent admin
          actions
        </h2>
        {audit === undefined ? (
          <p className="annotation mt-2 text-sm">loading…</p>
        ) : audit.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No admin actions yet.
          </p>
        ) : (
          <ul className="ruled-list mt-2 flex flex-col">
            {audit.map((e) => (
              <li key={e._id} className="py-2 text-sm">
                <span className="font-semibold">{e.adminName}</span>{" "}
                {e.action === "add" && `added ${e.amount} XP`}
                {e.action === "remove" && `removed ${e.amount} XP`}
                {e.action === "set" && `set XP to ${e.newXp}`}
                {e.action === "reset" && "reset XP"}
                <span className="text-muted-foreground">
                  {" "}
                  for {e.targetName} ({e.previousXp} → {e.newXp})
                </span>
                <span className="annotation block text-[11px]">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
