import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  AtSign,
  Check,
  MessageCircle,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSounds } from "@/hooks/use-settings";

type PublicInfo = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  school: string | null;
};

type SearchResult = PublicInfo & {
  requestState: "none" | "pending_out" | "pending_in" | "friends";
};

type RequestRow = {
  _id: string;
  userId: string;
  direction: "in" | "out";
  createdAt: number;
  user: PublicInfo | null;
};

type FriendRow = { userId: string; user: PublicInfo | null };

type Conversation = {
  conversationId: string;
  friendId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  lastMessage: string | null;
  lastMessageAt: number | null;
  unread: number;
};

type ChatMessage = {
  _id: string;
  senderId: string;
  body: string;
  createdAt: number;
  mine: boolean;
};

type Tab = "friends" | "requests" | "search" | "chat";
type ChatFilter = "all" | "unread" | "friends" | "recent";

function Avatar({ user, size = 10 }: { user: PublicInfo | null; size?: number }) {
  const initials =
    (user?.displayName ?? user?.username ?? "?").slice(0, 2).toUpperCase();
  return user?.avatar ? (
    <img
      src={user.avatar}
      alt=""
      className={cn("rounded-full border object-cover", `size-${size}`)}
    />
  ) : (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/15 font-bold text-primary",
        `size-${size}`,
      )}
    >
      {initials}
    </span>
  );
}

export default function Friends() {
  const sounds = useSounds();
  const { clerkUser, name: clerkName, imageUrl } = useAuth();
  const syncUsername = useMutation(api.friends.syncUsername);
  const meQ = useQuery(api.friends.me) as
    | (PublicInfo & { hasUsername: boolean })
    | undefined;
  const requests = useQuery(api.friends.listRequests) as
    | { incoming: RequestRow[]; outgoing: RequestRow[] }
    | undefined;
  const friends = useQuery(api.friends.friendsList) as FriendRow[] | undefined;

  const sendRequest = useMutation(api.friends.sendRequest);
  const respond = useMutation(api.friends.respondRequest);
  const removeFriend = useMutation(api.friends.removeFriend);

  const [tab, setTab] = useState<Tab>("friends");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);

  // Chat state
  const conversations = useQuery(api.chat.list) as Conversation[] | undefined;
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [chatSearch, setChatSearch] = useState("");

  // One-time username sync from Clerk per session.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current || meQ === undefined) return;
    syncedRef.current = true;
    void syncUsername({
      clerkUsername: clerkUser?.username ?? undefined,
      displayName: clerkName ?? undefined,
      imageUrl: imageUrl ?? undefined,
    }).catch(() => undefined);
  }, [meQ, clerkUser, clerkName, imageUrl, syncUsername]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const results = useQuery(
    api.friends.searchUsers,
    debounced.trim().length >= 2 ? { query: debounced } : "skip",
  ) as SearchResult[] | undefined;

  const incomingCount = requests?.incoming.length ?? 0;
  const totalUnread = (conversations ?? []).reduce((n, c) => n + c.unread, 0);

  const filteredChats = useMemo(() => {
    if (!conversations) return undefined;
    let rows = [...conversations];
    if (chatFilter === "unread") rows = rows.filter((c) => c.unread > 0);
    if (chatFilter === "friends")
      rows = rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    if (chatFilter === "recent")
      rows = rows.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
    if (chatSearch.trim()) {
      const needle = chatSearch.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.username ?? "").includes(needle) ||
          (c.displayName ?? "").toLowerCase().includes(needle),
      );
    }
    return rows;
  }, [conversations, chatFilter, chatSearch]);

  const doSend = async (toId: string) => {
    try {
      const r = await sendRequest({ toId });
      if (r === "sent") {
        toast.success("Chat request sent!");
        sounds.success();
      } else if (r === "already_friends") toast.info("You're already friends.");
      else if (r === "already_pending") toast.info("Request already pending.");
      else if (r === "self") toast.error("You can't add yourself.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request.");
    }
  };

  if (threadId) {
    return (
      <Thread
        conversationId={threadId}
        onBack={() => {
          sounds.click();
          setThreadId(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">👥 Friends</h1>
        <p className="annotation text-sm">
          {meQ?.hasUsername
            ? `your handle: @${meQ.username}`
            : "set a username so classmates can find you"}
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {(
          [
            { key: "friends", label: `My Friends` },
            { key: "chat", label: `Chat${totalUnread ? ` (${totalUnread})` : ""}` },
            { key: "requests", label: `Requests${incomingCount ? ` (${incomingCount})` : ""}` },
            { key: "search", label: "Search" },
          ] as Array<{ key: Tab; label: string }>
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              sounds.click();
              setTab(t.key);
            }}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold transition",
              tab === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "unread", "friends", "recent"] as ChatFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  sounds.click();
                  setChatFilter(f);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize",
                  chatFilter === f ? "bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                {f}
              </button>
            ))}
            <input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search chats…"
              className="h-9 min-w-32 flex-1 rounded-full border bg-background px-3 text-xs"
            />
          </div>

          {filteredChats === undefined ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : filteredChats.length === 0 ? (
            <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="text-3xl">💬</span>
              <p className="font-semibold">No conversations yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Add a friend, accept their request, and your private chat appears here.
              </p>
            </section>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredChats.map((c) => (
                <li key={c.conversationId}>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.click();
                      setThreadId(c.conversationId);
                    }}
                    className="paper-sheet flex w-full items-center gap-3 px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
                  >
                    <Avatar
                      user={{
                        userId: c.friendId,
                        username: c.username,
                        displayName: c.displayName,
                        avatar: c.avatar,
                        school: null,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">@{c.username ?? "user"}</p>
                      <p className="annotation truncate text-xs">
                        {c.lastMessage ?? "say hi 👋"}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "search" && (
        <section className="paper-sheet px-5 py-5">
          <label htmlFor="user-search" className="text-sm font-semibold">
            Find classmates by username
          </label>
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              id="user-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. study_bug"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              maxLength={30}
              autoComplete="off"
            />
          </div>

          {results === undefined ? null : results.length === 0 ? (
            debounced.trim().length >= 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users found for “{debounced}”.
              </p>
            ) : (
              <p className="annotation py-4 text-center text-xs">
                type at least 2 characters
              </p>
            )
          ) : (
            <ul className="ruled-list mt-3 flex flex-col">
              {results.map((u) => (
                <li key={u.userId} className="flex items-center gap-3 py-3">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      @{u.username ?? "?"}
                    </p>
                    <p className="annotation truncate text-xs">
                      {u.displayName ?? u.school ?? "Learnova student"}
                    </p>
                  </div>
                  {u.requestState === "none" && (
                    <button
                      type="button"
                      onClick={() => void doSend(u.userId)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                    >
                      <UserPlus className="size-3.5" /> Add Friend
                    </button>
                  )}
                  {u.requestState === "pending_out" && (
                    <span className="annotation shrink-0 text-xs">request sent</span>
                  )}
                  {u.requestState === "pending_in" && (
                    <button
                      type="button"
                      onClick={() => setTab("requests")}
                      className="shrink-0 rounded-lg border px-3 py-2 text-xs font-bold"
                    >
                      Respond →
                    </button>
                  )}
                  {u.requestState === "friends" && (
                    <span className="annotation shrink-0 text-xs">friends ✓</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "requests" && (
        <>
          <section className="paper-sheet px-5 py-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Friend Requests
            </h2>
            {requests === undefined ? (
              <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
            ) : requests.incoming.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                No pending requests
              </p>
            ) : (
              <ul className="ruled-list mt-2 flex flex-col">
                {requests.incoming.map((r) => (
                  <li key={r._id} className="flex items-center gap-3 py-3">
                    <Avatar user={r.user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        @{r.user?.username ?? "user"}
                      </p>
                      <p className="annotation truncate text-xs">
                        {r.user?.displayName ?? "wants to connect"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void respond({ requestId: r._id as never, accept: true });
                        sounds.success();
                      }}
                      aria-label="Accept"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void respond({ requestId: r._id as never, accept: false });
                        sounds.click();
                      }}
                      aria-label="Decline"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="paper-sheet px-5 py-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Pending Requests (sent)
            </h2>
            {requests === undefined ? (
              <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
            ) : requests.outgoing.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                No pending requests
              </p>
            ) : (
              <ul className="ruled-list mt-2 flex flex-col">
                {requests.outgoing.map((r) => (
                  <li key={r._id} className="flex items-center gap-3 py-3">
                    <Avatar user={r.user} />
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                      @{r.user?.username ?? "user"}
                    </p>
                    <span className="annotation shrink-0 text-xs">awaiting reply…</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "friends" && (
        <section className="paper-sheet px-5 py-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            My Friends
          </h2>
          {friends === undefined ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-3xl">🫂</span>
              <p className="font-semibold">No friends yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Search for a username to connect!
              </p>
              <button
                type="button"
                onClick={() => {
                  sounds.click();
                  setTab("search");
                }}
                className="mt-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Search className="inline size-4" /> Find classmates
              </button>
            </div>
          ) : (
            <ul className="ruled-list mt-2 flex flex-col">
              {friends.map((f) => (
                <li key={f.userId} className="flex items-center gap-3 py-3">
                  <Avatar user={f.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      @{f.user?.username ?? "user"}
                    </p>
                    <p className="annotation truncate text-xs">
                      {f.user?.displayName ?? "Learnova student"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.click();
                      setTab("chat");
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    <MessageCircle className="size-3.5" /> Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void removeFriend({ userId: f.userId });
                      sounds.click();
                    }}
                    aria-label="Remove friend"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── 1:1 chat thread ───────────────────────────────────────────────── */

function Thread({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const sounds = useSounds();
  const messages = useQuery(api.chat.getMessages, { conversationId: conversationId as never }) as
    | ChatMessage[]
    | undefined;
  const markRead = useMutation(api.chat.markRead);
  const send = useMutation(api.chat.send);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void markRead({ conversationId: conversationId as never });
  }, [conversationId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await send({ conversationId: conversationId as never, body });
      if (r === "sent") {
        setDraft("");
        sounds.success();
      } else {
        toast.error("You can only message accepted friends.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[65vh] flex-col">
      <div className="flex items-center gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => {
            sounds.click();
            onBack();
          }}
          aria-label="Back"
          className="flex size-10 items-center justify-center rounded-full border"
        >
          <ArrowLeft className="size-4" />
        </button>
        <p className="text-sm font-bold">Conversation</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {messages === undefined ? (
          <div className="h-20 animate-pulse rounded bg-muted" />
        ) : messages.length === 0 ? (
          <p className="annotation py-10 text-center text-sm">
            No messages yet — say hi! 👋
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => (
              <li
                key={m._id}
                className={cn("flex", m.mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    m.mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border bg-background",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      m.mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="h-12 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
