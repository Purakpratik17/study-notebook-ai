import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Inbox, Loader2, Search, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSounds } from "@/hooks/use-settings";
import { LoadingNotebook } from "@/components/loading";

/* ═══════════════════════════════════════════════════════════════════════
   SHARED WITH ME / SHARED BY ME

   • Shared With Me — materials received through chats. Server returns
     only rows where the viewer is a participant/group member; the
     sender's original stays read-only, "Save a copy" inserts a new
     owned row (api.shares.saveCopy).
   • Shared By Me — every share the user has sent.
   ═══════════════════════════════════════════════════════════════════════ */

const TYPE_META: Record<string, { label: string; emoji: string; open: (id: string) => string }> = {
  ai_note: { label: "AI Note", emoji: "✨", open: (id) => `/ai-study?note=${id}` },
  quiz: { label: "Quiz", emoji: "🧠", open: (id) => `/ai-study?note=${id}` },
  my_note: { label: "My Note", emoji: "🗒️", open: (id) => `/my-notes?note=${id}` },
  whiteboard: { label: "Whiteboard", emoji: "🎨", open: () => `/whiteboard` },
};

type ShareRow = {
  _id: string;
  targetType: string;
  targetId: string;
  title: string;
  senderId?: string;
  senderName?: string;
  createdAt: number;
};

export default function Shared() {
  const sounds = useSounds();
  const [tab, setTab] = useState<"withMe" | "byMe">("withMe");
  const [search, setSearch] = useState("");

  const withMe = useQuery(api.shares.sharedWithMe) as ShareRow[] | undefined;
  const byMe = useQuery(api.shares.sharedByMe) as ShareRow[] | undefined;
  const saveCopy = useMutation(api.shares.saveCopy);

  const loading = (tab === "withMe" ? withMe : byMe) === undefined;
  const rows = ((tab === "withMe" ? withMe : byMe) ?? []).filter((r) =>
    r.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Share2 className="size-7 text-primary" /> Shared Materials
        </h1>
        <p className="annotation text-sm">
          study material exchanged through your chats
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-card p-1">
        <button
          onClick={() => { sounds.click(); setTab("withMe"); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
            tab === "withMe" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          <Inbox className="size-4" /> Shared with me
        </button>
        <button
          onClick={() => { sounds.click(); setTab("byMe"); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
            tab === "byMe" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          <Send className="size-4" /> Shared by me
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shared materials…"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingNotebook className="scale-75" />
        </div>
      ) : rows.length === 0 ? (
        <div className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          {tab === "withMe" ? (
            <Inbox className="size-8 text-ink-faint" />
          ) : (
            <Send className="size-8 text-ink-faint" />
          )}
          <p className="font-semibold">
            {tab === "withMe" ? "Nothing shared with you yet" : "You haven't shared anything yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {tab === "withMe"
              ? "When friends share notes, whiteboards or quizzes in chat, they appear here."
              : "Open a chat, tap the book icon, and share a study material."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const meta = TYPE_META[r.targetType] ?? TYPE_META.ai_note;
            return (
              <li
                key={r._id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                  {meta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="annotation truncate text-[10px]">
                    {meta.label}
                    {tab === "withMe"
                      ? ` · from ${r.senderName ?? "a friend"}`
                      : ""}{" "}
                    · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button asChild variant="outline" size="sm">
                    <Link to={meta.open(r.targetId)}>Open</Link>
                  </Button>
                  {tab === "withMe" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await saveCopy({ shareId: r._id as never });
                          if (res === "saved") toast.success("Saved to your library 📚");
                          else if (res === "not_authorized") toast.error("Not authorized");
                          else toast.error("No longer available.");
                        } catch {
                          toast.error("Could not save a copy.");
                        }
                      }}
                    >
                      Save copy
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loading && (
        <Loader2 className="mx-auto hidden size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
