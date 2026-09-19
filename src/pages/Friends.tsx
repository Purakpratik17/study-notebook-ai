import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Check,
  Image as ImageIcon,
  Unlock,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Smile,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSounds } from "@/hooks/use-settings";
import { useBannerMargin } from "@/hooks/use-banner-margin";
import { useChatPlus } from "@/hooks/use-chat-plus";
import { ChatPlusSheet } from "@/components/ChatPlusSheet";

/** Fires a toast + (optional) system notification for new chat/group messages. */
function useNewMessageNotifications(
  items: Array<{
    key: string;
    unread: number;
    lastMessage: string | null;
    name: string;
    muted: boolean;
    active: boolean;
  }> | undefined,
) {
  const prevRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    if (!items) return;
    const prev = prevRef.current;
    if (prev) {
      for (const it of items) {
        const before = prev.get(it.key) ?? 0;
        if (it.unread > before && !it.active && !it.muted) {
          const text = it.lastMessage ?? "sent you a message";
          toast(`${it.name}: ${text}`, { icon: "💬" });
          try {
            if (
              "Notification" in window &&
              Notification.permission === "granted" &&
              document.hidden
            ) {
              new Notification(`Cerevyn — ${it.name}`, { body: text });
            }
          } catch {
            /* notifications unsupported — toast is enough */
          }
        }
      }
    }
    prevRef.current = new Map(items.map((it) => [it.key, it.unread]));
  }, [items]);

  // Ask once per session (silently ignores denial).
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      const t = setTimeout(() => void Notification.requestPermission().catch(() => undefined), 5000);
      return () => clearTimeout(t);
    }
  }, []);
}

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
  friendPlus: boolean;
};

type ChatMessage = {
  _id: string;
  senderId: string;
  body: string;
  createdAt: number;
  mine: boolean;
  kind: "image" | "video" | "file" | null;
  mediaType: string | null;
  durationSec: number | null;
  fileName: string | null;
  fileSize: number | null;
  friendPlus: boolean;
};

const MAX_VIDEO_SEC = 180;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Chat+ badge — small purple pill, distinct from moderator styling. */
export function PlusBadge() {
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-purple-600/90 px-1.5 py-px align-middle text-[9px] font-bold uppercase tracking-wide text-white">
      Chat+
    </span>
  );
}

/** Purple Chat+ username (readable in both themes). */
const plusNameClass = "font-bold text-purple-600 dark:text-purple-400";

/**
 * POST a file to a Convex upload URL via XHR. More reliable than fetch() for
 * File bodies inside the Android WebView, and reports real status codes.
 */
function uploadFile(uploadUrl: string, file: File): Promise<{ storageId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Upload returned an invalid response."));
        }
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Upload failed — check your internet connection."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file."));
    xhr.timeout = 120_000; // Convex upload POST limit is 2 minutes
    xhr.send(file);
  });
}

const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Smileys",
    emojis: "😀 😃 😄 😁 😆 😅 🤣 😊 🙂 😉 😍 🤩 😘 🤔 🤨 😴 😤 😎 🥳 😢 😭 🥺 😱 🤯 😇 🤗 🤫 😂 🥹 😜".split(" "),
  },
  {
    label: "Study",
    emojis: "📚 ✏️ 📝 📖 🎓 🧠 💡 📐 🔬 🧪 🧮 📊 🖊️ 📋 ⏰ 🎯 ✅ ❌ ⭐ 🔥 💪 🚀 🏆 🥇 🎉 🎊 👏 🙌 👍 👎".split(" "),
  },
  {
    label: "More",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🌟 ✨ ⚡ 🌈 ☕ 🍕 🍫 🎮 🎵 🐱 🐶 🦊 🐼 🌍 🌙 ☀️ 🤝 💯 🙏 🫶 🥰 🤝".split(" "),
  },
];

type Tab = "friends" | "requests" | "search" | "chat";
type ChatFilter = "all" | "unread" | "friends" | "recent";
type ChatMode = "dm" | "groups";

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
  const [chatMode, setChatMode] = useState<ChatMode>("dm");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const createGroup = useMutation(api.groupChat.createGroup);

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

  // Group chat state
  const groups = useQuery(api.groupChat.list) as
    | Array<{
        groupId: string;
        name: string;
        memberCount: number;
        ownerId: string;
        muted: boolean;
        lastMessage: string | null;
        lastMessageAt: number | null;
        lastSender: string | null;
        unread: number;
      }>
    | undefined;
  const [groupThreadId, setGroupThreadId] = useState<string | null>(null);

  useNewMessageNotifications(
    useMemo(() => {
      if (!conversations && !groups) return undefined;
      const items = [];
      for (const c of conversations ?? []) {
        items.push({
          key: `dm:${c.conversationId}`,
          unread: c.unread,
          lastMessage: c.lastMessage,
          name: c.displayName ?? c.username ?? "someone",
          muted: false,
          active: threadId === c.conversationId,
        });
      }
      for (const g of groups ?? []) {
        items.push({
          key: `group:${g.groupId}`,
          unread: g.unread,
          lastMessage: g.lastMessage,
          name: g.name,
          muted: g.muted,
          active: groupThreadId === g.groupId,
        });
      }
      return items;
    }, [conversations, groups, threadId, groupThreadId]),
  );
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

  if (groupThreadId) {
    return (
      <GroupThread
        groupId={groupThreadId}
        onBack={() => {
          sounds.click();
          setGroupThreadId(null);
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
          {/* DM / Groups switch + create-group */}
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2">
              {([
                { key: "dm", label: "Direct" },
                { key: "groups", label: "Groups" },
              ] as Array<{ key: ChatMode; label: string }>).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    sounds.click();
                    setChatMode(m.key);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-semibold",
                    chatMode === m.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-background",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {chatMode === "groups" && (
              <button
                type="button"
                onClick={() => {
                  sounds.click();
                  setShowCreateGroup(true);
                }}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <UserPlus className="size-3.5" /> New group
              </button>
            )}
          </div>

          {chatMode === "groups" && showCreateGroup && (
            <CreateGroup
              friends={friends ?? []}
              onCancel={() => setShowCreateGroup(false)}
              onCreated={(groupId) => {
                setShowCreateGroup(false);
                setGroupThreadId(groupId);
              }}
            />
          )}

          {chatMode === "groups" && !showCreateGroup &&
            (groups === undefined ? (
              <div className="shimmer h-20 rounded-lg" />
            ) : groups.length === 0 ? (
              <section className="paper-sheet flex flex-col items-center gap-2 px-6 py-10 text-center">
                <span className="text-3xl">👥</span>
                <p className="font-semibold">No group chats yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Create a study group and add your friends!
                </p>
              </section>
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((g) => (
                  <li key={g.groupId}>
                    <button
                      type="button"
                      onClick={() => {
                        sounds.click();
                        setGroupThreadId(g.groupId);
                      }}
                      className="paper-sheet flex w-full items-center gap-3 px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-lg">
                        👥
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{g.name}</p>
                        <p className="annotation truncate text-xs">
                          {g.lastMessage ?? `group · ${g.memberCount} members`}
                        </p>
                      </div>
                      {g.unread > 0 && (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                          {g.unread}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ))}

          {chatMode === "dm" && (
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
            <div className="shimmer h-20 rounded-lg" />
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
                      <p className="truncate text-sm font-semibold">
                        <span className={c.friendPlus ? plusNameClass : ""}>@{c.username ?? "user"}</span>
                        {c.friendPlus && <PlusBadge />}
                      </p>
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
              ))}            </ul>
          )}
          </>
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
                      {u.displayName ?? u.school ?? "Cerevyn student"}
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
              <div className="shimmer mt-3 h-16 rounded" />
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
              <div className="shimmer mt-3 h-16 rounded" />
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
            <div className="shimmer mt-3 h-16 rounded" />
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
                      {f.user?.displayName ?? "Cerevyn student"}
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
  const setMuted = useMutation(api.chat.setMuted);
  const setBlocked = useMutation(api.chat.setBlocked);
  const generateUploadUrl = useMutation(api.chat.generateMediaUploadUrl);
  const convState = useQuery(api.chat.getConvState, {
    conversationId: conversationId as never,
  }) as { muted: boolean; blocked: boolean; blockedMe: boolean } | null | undefined;
  const bannerVisible = useBannerMargin();
  const { plus, limits } = useChatPlus();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [preview, setPreview] = useState<{
    kind: "image" | "video" | "file";
    file: File;
    url: string | null;
    durationSec?: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: "image" | "video"; url: string } | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showPlus, setShowPlus] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void markRead({ conversationId: conversationId as never });
  }, [conversationId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, preview]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const submit = async () => {
    const body = draft.trim();
    if ((!body && !preview) || sending || uploading) return;
    setSending(true);
    try {
      let media:
        | {
            kind: "image" | "video" | "file";
            storageId: never;
            mediaType: string;
            durationSec?: number;
            fileName?: string;
            fileSize?: number;
          }
        | undefined;
      if (preview) {
        const uploadUrl = await generateUploadUrl({});
        const { storageId } = await uploadFile(uploadUrl, preview.file);
        media = {
          kind: preview.kind,
          storageId: storageId as never,
          mediaType: preview.file.type || "application/octet-stream",
          durationSec: preview.durationSec,
          fileName: preview.kind === "file" ? preview.file.name : undefined,
          fileSize: preview.kind === "file" ? preview.file.size : undefined,
        };
      }
      const r = await send({
        conversationId: conversationId as never,
        body:
          body ||
          (preview
            ? preview.kind === "image"
              ? "📷 Photo"
              : preview.kind === "video"
                ? "🎥 Video"
                : `📎 ${preview.file.name}`
            : ""),
        ...media,
      });
      if (r === "sent") {
        setDraft("");
        if (preview?.url) URL.revokeObjectURL(preview.url);
        setPreview(null);
        sounds.success();
      } else if (r === "blocked") {
        toast.error("You can't message this person.");
      } else {
        toast.error("You can only message accepted friends.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setVideoError(null);
    if (!file) return;
    if (file.type.startsWith("image/")) {
      if (file.size > limits.image) {
        toast.error(plus ? "Images must be 25 MB or smaller." : "Images must be 5 MB or smaller.");
        return;
      }
      setPreview({ kind: "image", file, url: URL.createObjectURL(file) });
    } else if (file.type.startsWith("video/")) {
      if (file.size > limits.video) {
        toast.error(plus ? "Videos must be 500 MB or smaller." : "Videos must be 100 MB or smaller.");
        return;
      }
      const url = URL.createObjectURL(file);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const duration = probe.duration;
        if (!Number.isFinite(duration) || duration > limits.videoSec + 1) {
          URL.revokeObjectURL(url);
          if (!plus) {
            // Free user picked a >3-min video — offer the Chat+ upgrade
            // instead of a dead-end error.
            setShowPlus(true);
            toast.info("Videos over 3 minutes need Chat+ 💜");
          } else {
            setVideoError("Videos must be 1 hour or shorter.");
            toast.error("Videos must be 1 hour or shorter.");
          }
          return;
        }
        setPreview({ kind: "video", file, url, durationSec: duration });
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setVideoError("Could not read this video.");
      };
      probe.src = url;
    } else {
      // Chat+ file attachment (any type, server re-validates size).
      if (!plus) {
        toast.error("Chat+ is required to send files 💜");
        return;
      }
      if (file.size > limits.file) {
        toast.error("Files must be 100 MB or smaller.");
        return;
      }
      setPreview({ kind: "file", file, url: null });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div
        className="flex items-center gap-2 border-b px-2 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
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
        <p className="min-w-0 flex-1 truncate text-sm font-bold">Conversation</p>
        <button
          type="button"
          aria-label="Chat+ settings"
          onClick={() => {
            sounds.click();
            setShowPlus(true);
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border text-purple-600 dark:text-purple-400"
        >
          💜
        </button>
        <button
          type="button"
          aria-label={convState?.muted ? "Unmute notifications" : "Mute notifications"}
          title={convState?.muted ? "Unmute" : "Mute"}
          onClick={async () => {
            const next = !convState?.muted;
            await setMuted({ conversationId: conversationId as never, muted: next });
            toast.success(next ? "Conversation muted 🔕" : "Unmuted 🔔");
            sounds.click();
          }}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border",
            convState?.muted && "bg-primary/10 border-primary",
          )}
        >
          {convState?.muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
        </button>
        <button
          type="button"
          aria-label={convState?.blocked ? "Unblock" : "Block"}
          title={convState?.blocked ? "Unblock" : "Block"}
          onClick={async () => {
            if (!convState) return;
            if (!convState.blocked && !confirm("Block this person? The chat will be hidden and they won't be able to message you.")) return;
            await setBlocked({ conversationId: conversationId as never, blocked: !convState.blocked });
            if (!convState.blocked) {
              toast.success("Blocked. The chat is now hidden.");
              onBack();
            } else {
              toast.success("Unblocked.");
            }
            sounds.click();
          }}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border",
            convState?.blocked ? "bg-primary/10 border-primary" : "text-destructive",
          )}
        >
          {convState?.blocked ? <Unlock className="size-4" /> : <Ban className="size-4" />}
        </button>
      </div>

      {convState?.blockedMe && (
        <p className="rounded-lg bg-muted px-4 py-2 text-center text-xs text-muted-foreground">
          You can't send messages in this conversation.
        </p>
      )}

      {showPlus && <ChatPlusSheet onClose={() => setShowPlus(false)} />}

      <div className="flex-1 overflow-y-auto py-4">
        {messages === undefined ? (
          <div className="shimmer h-20 rounded" />
        ) : messages.length === 0 ? (
          <p className="annotation py-10 text-center text-sm">
            No messages yet — say hi! 👋
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => (
              <ChatBubble key={m._id} m={m} onOpenLightbox={setLightbox} />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {showEmoji && (
        <div className="mb-2 rounded-xl border bg-background p-3 shadow-sm">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="mb-2 last:mb-0">
              <p className="annotation mb-1 text-[10px] uppercase tracking-wide">
                {g.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.emojis.map((em, i) => (
                  <button
                    key={`${g.label}-${i}`}
                    type="button"
                    onClick={() => setDraft((d) => d + em)}
                    className="rounded-lg p-1.5 text-xl leading-none transition hover:bg-muted"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border bg-background p-2">
          {preview.kind === "image" && preview.url ? (
            <img src={preview.url} alt="" className="size-14 rounded-lg object-cover" />
          ) : preview.kind === "video" && preview.url ? (
            <video src={preview.url} className="size-14 rounded-lg object-cover" muted />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-lg bg-purple-600/10 text-xl">
              📎
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {preview.kind === "image"
                ? "Photo"
                : preview.kind === "video"
                  ? "Video"
                  : preview.file.name}
              {preview.durationSec
                ? ` · ${Math.round(preview.durationSec)}s`
                : ""}
            </p>
            <p className="annotation truncate text-[10px]">
              {(preview.file.size / 1024 / 1024).toFixed(1)} MB — will be sent with your message
            </p>
            {videoError && (
              <p className="text-[10px] font-semibold text-destructive">{videoError}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => {
              if (preview.url) URL.revokeObjectURL(preview.url);
              setPreview(null);
              sounds.click();
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t px-2 pt-3"
        style={{
          // When the banner is visible it already occupies the space above
          // the Android nav/gesture area, so the input only clears the
          // banner. With no banner, it clears only the gesture area.
          marginBottom: bannerVisible ? "64px" : "env(safe-area-inset-bottom, 0px)",
          paddingBottom: "10px",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,*/*"
          className="hidden"
          onChange={pickFile}
        />
        <button
          type="button"
          aria-label="Emoji"
          onClick={() => {
            sounds.click();
            setShowEmoji((s) => !s);
          }}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border",
            showEmoji && "bg-primary/10 border-primary",
          )}
        >
          <Smile className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Attach photo or video"
          disabled={uploading || sending}
          onClick={() => {
            sounds.click();
            fileInputRef.current?.click();
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-50"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="h-12 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={(!draft.trim() && !preview) || sending || uploading || convState?.blockedMe}
          aria-label="Send"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          {lightbox.kind === "image" ? (
            <img
              src={lightbox.url}
              alt=""
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay={false}
              className="max-h-[85vh] max-w-full rounded-lg"
            />
          )}
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* Chat+ sheet moved to @/components/ChatPlusSheet (shared with Settings) */

function ChatBubble({
  m,
  onOpenLightbox,
}: {
  m: ChatMessage;
  onOpenLightbox: (v: { kind: "image" | "video"; url: string }) => void;
}) {
  const getMediaUrl = useQuery(
    api.chat.getMediaUrl,
    m.kind ? ({ messageId: m._id } as never) : "skip",
  ) as string | null | undefined;

  const body =
    m.body &&
    m.body !== "📷 Photo" &&
    m.body !== "🎥 Video" &&
    !m.body.startsWith("📎 ")
      ? m.body
      : null;

  return (
    <li className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] overflow-hidden rounded-2xl text-sm",
          m.kind ? "p-1.5" : "px-4 py-2.5",
          m.mine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border bg-background",
        )}
      >
        {m.kind === "image" &&
          (getMediaUrl ? (
            <img
              src={getMediaUrl}
              alt="Photo"
              onClick={() => onOpenLightbox({ kind: "image", url: getMediaUrl })}
              className="max-h-56 w-52 cursor-pointer rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-28 w-52 items-center justify-center rounded-xl bg-muted">
              <ImageIcon className="size-5 text-muted-foreground" />
            </div>
          ))}
        {m.kind === "video" &&
          (getMediaUrl ? (
            <div
              className="cursor-pointer"
              onClick={() => onOpenLightbox({ kind: "video", url: getMediaUrl })}
            >
              <video src={getMediaUrl} className="max-h-56 w-52 rounded-xl object-cover" muted preload="metadata" />
              <span className="annotation mt-1 block px-2 text-[10px]">
                ▶ {m.durationSec ? `${Math.round(m.durationSec)}s` : "Video"} — tap to play
              </span>
            </div>
          ) : (
            <div className="flex h-28 w-52 items-center justify-center rounded-xl bg-muted">
              <span className="text-muted-foreground">🎥</span>
            </div>
          ))}
        {m.kind === "file" &&
          (getMediaUrl ? (
            <a
              href={getMediaUrl}
              target="_blank"
              rel="noreferrer"
              className="mx-1 flex items-center gap-2.5 rounded-xl bg-black/5 p-2.5 dark:bg-white/10"
            >
              <span className="text-xl">📎</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{m.fileName ?? "File"}</span>
                <span className="annotation block text-[10px]">
                  {m.fileSize ? `${(m.fileSize / 1024 / 1024).toFixed(1)} MB · ` : ""}
                  Tap to open/download
                </span>
              </span>
            </a>
          ) : (
            <div className="mx-1 flex items-center gap-2.5 rounded-xl bg-black/5 p-2.5 dark:bg-white/10">
              <span className="text-xl">📎</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{m.fileName ?? "File"}</span>
                <span className="annotation block text-[10px]">
                  {m.fileSize ? `${(m.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                </span>
              </span>
            </div>
          ))}
        {body && (
          <p className={cn("whitespace-pre-wrap break-words", m.kind && "px-2.5 pb-1 pt-1.5")}>
            {body}
          </p>
        )}
        <p
          className={cn(
            "mt-1 px-2 text-[10px]",
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
  );
}

/* ─── Create group ──────────────────────────────────────────────────── */

function CreateGroup({
  friends,
  onCancel,
  onCreated,
}: {
  friends: FriendRow[];
  onCancel: () => void;
  onCreated: (groupId: string) => void;
}) {
  const sounds = useSounds();
  const createGroup = useMutation(api.groupChat.createGroup);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const r = await createGroup({ name, memberIds: [...selected] });
      if (r === "empty_name") {
        toast.error("Give your group a name.");
        return;
      }
      sounds.success();
      toast.success("Group created! 🎉");
      onCreated(r.groupId as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="paper-sheet mb-4 px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Create a group 👥</h3>
        <button
          type="button"
          aria-label="Cancel"
          onClick={onCancel}
          className="flex size-8 items-center justify-center rounded-full border"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name (e.g. Biology Squad)"
        className="h-12 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        maxLength={60}
      />
      {friends.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Add friends first to invite them to a group.
        </p>
      ) : (
        <ul className="ruled-list mt-2 max-h-48 overflow-y-auto">
          {friends.map((f) => (
            <li key={f.userId} className="flex items-center gap-3 py-2">
              <Avatar user={f.user} size={8} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                @{f.user?.username ?? "user"}
              </p>
              <button
                type="button"
                aria-label={selected.has(f.userId) ? "Remove from group" : "Add to group"}
                onClick={() => toggle(f.userId)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-bold",
                  selected.has(f.userId)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground",
                )}
              >
                {selected.has(f.userId) ? "✓" : "+"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={!name.trim() || busy}
        onClick={() => void submit()}
        className="mt-3 w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        Create group ({selected.size + 1} members)
      </button>
    </section>
  );
}

/* ─── Group thread ──────────────────────────────────────────────────── */

function GroupThread({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const sounds = useSounds();
  const messages = useQuery(api.groupChat.getMessages, { groupId: groupId as never }) as
    | ChatMessage[]
    | null
    | undefined;
  const info = useQuery(api.groupChat.memberInfo, { groupId: groupId as never }) as
    | {
        name: string;
        ownerId: string;
        meId: string;
        members: Record<
          string,
          { username: string | null; displayName: string | null; avatar: string | null; plus: boolean }
        >;
      }
    | null
    | undefined;
  const markRead = useMutation(api.groupChat.markRead);
  const send = useMutation(api.groupChat.send);
  const setMuted = useMutation(api.groupChat.setMuted);
  const leaveGroup = useMutation(api.groupChat.leave);
  const generateUploadUrl = useMutation(api.groupChat.generateMediaUploadUrl);
  const groups = useQuery(api.groupChat.list) as
    | Array<{ groupId: string; muted: boolean }>
    | undefined;
  const myRow = groups?.find((g) => g.groupId === groupId);
  const bannerVisible = useBannerMargin();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [preview, setPreview] = useState<{
    kind: "image" | "video";
    file: File;
    url: string;
    durationSec?: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: "image" | "video"; url: string } | null>(null);
  const { plus, limits } = useChatPlus();
  const [showPlus, setShowPlus] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void markRead({ groupId: groupId as never });
  }, [groupId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, preview]);

  const submit = async () => {
    const body = draft.trim();
    if ((!body && !preview) || sending) return;
    setSending(true);
    try {
      let media:
        | { kind: "image" | "video"; storageId: never; mediaType: string; durationSec?: number }
        | undefined;
      if (preview) {
        const uploadUrl = await generateUploadUrl({});
        const { storageId } = await uploadFile(uploadUrl, preview.file);
        media = {
          kind: preview.kind,
          storageId: storageId as never,
          mediaType: preview.file.type,
          durationSec: preview.durationSec,
        };
      }
      const r = await send({
        groupId: groupId as never,
        body: body || (preview ? (preview.kind === "image" ? "📷 Photo" : "🎥 Video") : ""),
        ...media,
      });
      if (r === "sent") {
        setDraft("");
        if (preview?.url) URL.revokeObjectURL(preview.url);
        setPreview(null);
        sounds.success();
      } else {
        toast.error("You are no longer in this group.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) {
      if (file.size > limits.image) {
        toast.error(plus ? "Images must be 25 MB or smaller." : "Images must be 5 MB or smaller.");
        return;
      }
      setPreview({ kind: "image", file, url: URL.createObjectURL(file) });
    } else if (file.type.startsWith("video/")) {
      if (file.size > limits.video) {
        toast.error(plus ? "Videos must be 500 MB or smaller." : "Videos must be 100 MB or smaller.");
        return;
      }
      const url = URL.createObjectURL(file);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        const duration = probe.duration;
        if (!Number.isFinite(duration) || duration > limits.videoSec + 1) {
          URL.revokeObjectURL(url);
          if (!plus) {
            setShowPlus(true);
            toast.info("Videos over 3 minutes need Chat+ 💜");
          } else {
            toast.error("Videos must be 1 hour or shorter.");
          }
          return;
        }
        setPreview({ kind: "video", file, url, durationSec: duration });
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("Could not read this video. Videos must be 3 minutes or shorter.");
      };
      probe.src = url;
    } else {
      toast.error("Only images and videos are supported.");
    }
  };

  const senderName = (id: string) => {
    const m = info?.members[id];
    return m?.displayName ?? m?.username ?? "someone";
  };
  const senderPlus = (id: string) => Boolean(info?.members[id]?.plus);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div
        className="flex items-center gap-2 border-b px-2 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
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
        <button
          type="button"
          aria-label="Chat+ settings"
          onClick={() => {
            sounds.click();
            setShowPlus(true);
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border text-purple-600 dark:text-purple-400"
        >
          💜
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">👥 {info?.name ?? "Group"}</p>
          <p className="annotation text-[10px]">
            {info ? `${Object.keys(info.members).length} members` : " "}
          </p>
        </div>
        <button
          type="button"
          aria-label={myRow?.muted ? "Unmute" : "Mute"}
          onClick={async () => {
            const next = !myRow?.muted;
            await setMuted({ groupId: groupId as never, muted: next });
            toast.success(next ? "Group muted 🔕" : "Unmuted 🔔");
            sounds.click();
          }}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border",
            myRow?.muted && "bg-primary/10 border-primary",
          )}
        >
          {myRow?.muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Leave group"
          onClick={async () => {
            if (!confirm("Leave this group?")) return;
            await leaveGroup({ groupId: groupId as never });
            toast.success("You left the group.");
            onBack();
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {messages === undefined || messages === null ? (
          <div className="shimmer h-20 rounded" />
        ) : messages.length === 0 ? (
          <p className="annotation py-10 text-center text-sm">
            No messages yet — start the conversation! 👋
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => (
              <li key={m._id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] overflow-hidden rounded-2xl text-sm",
                    m.kind ? "p-1.5" : "px-4 py-2.5",
                    m.mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border bg-background",
                  )}
                >
                  {!m.mine && (
                    <p className="annotation mb-0.5 px-2 text-[10px] font-bold">
                      <span className={senderPlus(m.senderId) ? plusNameClass : ""}>
                        {senderName(m.senderId)}
                      </span>
                      {senderPlus(m.senderId) && <PlusBadge />}
                    </p>
                  )}
                  <GroupMedia
                    m={m}
                    onOpenLightbox={setLightbox}
                  />
                  {m.body && m.body !== "📷 Photo" && m.body !== "🎥 Video" && (
                    <p className={cn("whitespace-pre-wrap break-words", m.kind && "px-2.5 pb-1 pt-1.5")}>
                      {m.body}
                    </p>
                  )}
                  <p
                    className={cn(
                      "mt-1 px-2 text-[10px]",
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

      {showPlus && <ChatPlusSheet onClose={() => setShowPlus(false)} />}

      {showEmoji && (
        <div className="mb-2 rounded-xl border bg-background p-3 shadow-sm">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="mb-2 last:mb-0">
              <p className="annotation mb-1 text-[10px] uppercase tracking-wide">{g.label}</p>
              <div className="flex flex-wrap gap-1">
                {g.emojis.map((em, i) => (
                  <button
                    key={`${g.label}-${i}`}
                    type="button"
                    onClick={() => setDraft((d) => d + em)}
                    className="rounded-lg p-1.5 text-xl leading-none transition hover:bg-muted"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border bg-background p-2">
          {preview.kind === "image" ? (
            <img src={preview.url} alt="" className="size-14 rounded-lg object-cover" />
          ) : (
            <video src={preview.url} className="size-14 rounded-lg object-cover" muted />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {preview.kind === "image" ? "Photo" : "Video"}
              {preview.durationSec ? ` · ${Math.round(preview.durationSec)}s` : ""}
            </p>
            <p className="annotation truncate text-[10px]">
              {(preview.file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={() => {
              URL.revokeObjectURL(preview.url);
              setPreview(null);
              sounds.click();
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t px-2 pt-3"
        style={{
          marginBottom: `calc(${bannerVisible ? 64 : 0}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: "10px",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={plus ? "image/*,video/*,*/*" : "image/*,video/*"}
          className="hidden"
          onChange={pickFile}
        />
        <button
          type="button"
          aria-label="Emoji"
          onClick={() => {
            sounds.click();
            setShowEmoji((s) => !s);
          }}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border",
            showEmoji && "bg-primary/10 border-primary",
          )}
        >
          <Smile className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Attach photo or video"
          disabled={sending}
          onClick={() => {
            sounds.click();
            fileInputRef.current?.click();
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-50"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the group…"
          className="h-12 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={(!draft.trim() && !preview) || sending}
          aria-label="Send"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          {lightbox.kind === "image" ? (
            <img
              src={lightbox.url}
              alt=""
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay={false}
              className="max-h-[85vh] max-w-full rounded-lg"
            />
          )}
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* Media bubble for group messages (members-only signed URL). */
function GroupMedia({
  m,
  onOpenLightbox,
}: {
  m: ChatMessage;
  onOpenLightbox: (v: { kind: "image" | "video"; url: string }) => void;
}) {
  const getMediaUrl = useQuery(
    api.groupChat.getMediaUrl,
    m.kind ? ({ messageId: m._id } as never) : "skip",
  ) as string | null | undefined;

  if (!m.kind) return null;
  if (m.kind === "image") {
    return getMediaUrl ? (
      <img
        src={getMediaUrl}
        alt="Photo"
        onClick={() => onOpenLightbox({ kind: "image", url: getMediaUrl })}
        className="max-h-56 w-52 cursor-pointer rounded-xl object-cover"
        loading="lazy"
      />
    ) : (
      <div className="flex h-28 w-52 items-center justify-center rounded-xl bg-muted">
        <ImageIcon className="size-5 text-muted-foreground" />
      </div>
    );
  }
  return getMediaUrl ? (
    <div
      className="cursor-pointer"
      onClick={() => onOpenLightbox({ kind: "video", url: getMediaUrl })}
    >
      <video src={getMediaUrl} className="max-h-56 w-52 rounded-xl object-cover" muted preload="metadata" />
      <span className="annotation mt-1 block px-2 text-[10px]">
        ▶ {m.durationSec ? `${Math.round(m.durationSec)}s` : "Video"} — tap to play
      </span>
    </div>
  ) : (
    <div className="flex h-28 w-52 items-center justify-center rounded-xl bg-muted">
      <span className="text-muted-foreground">🎥</span>
    </div>
  );
}
