import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Loader2,
  Presentation,
  Search,
  ScrollText,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSounds } from "@/hooks/use-settings";

/* ═══════════════════════════════════════════════════════════════════════
   SHARE MATERIAL SHEET — pick one of your study materials and send it
   into a chat conversation. The material stays in YOUR library; the
   recipient gets a read-only card with an optional "Save a copy".

   Security note: the backend re-validates that you own the material and
   belong to the destination conversation — this sheet is only UI.
   ═══════════════════════════════════════════════════════════════════════ */

type MaterialType = "ai_note" | "my_note" | "whiteboard" | "quiz";

type Pick = {
  key: string;
  type: MaterialType;
  id: string;
  title: string;
  meta: string;
};

const TYPE_META: Record<MaterialType, { label: string; emoji: string }> = {
  ai_note: { label: "AI Note", emoji: "✨" },
  my_note: { label: "My Note", emoji: "🗒️" },
  whiteboard: { label: "Whiteboard", emoji: "🎨" },
  quiz: { label: "Quiz", emoji: "🧠" },
};

export function ShareMaterialSheet({
  conversationId,
  onClose,
  onSent,
}: {
  conversationId: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const sounds = useSounds();
  const notes = useQuery(api.notes.list);
  const myNotes = useQuery(api.myNotes.list);
  const boards = useQuery(api.whiteboards.list);
  const share = useMutation(api.shares.share);
  const sendMessage = useMutation(api.chat.send);

  const [tab, setTab] = useState<MaterialType>("ai_note");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pick | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const materials: Pick[] = useMemo(() => {
    const rows: Pick[] = [];
    for (const n of notes ?? []) {
      rows.push({ key: `ai:${n._id}`, type: "ai_note", id: n._id, title: n.topic, meta: "AI-generated study note" });
      if (n.quizCount > 0)
        rows.push({ key: `quiz:${n._id}`, type: "quiz", id: n._id, title: `Quiz — ${n.topic}`, meta: `${n.quizCount} questions` });
    }
    for (const n of myNotes ?? [])
      rows.push({ key: `mn:${n._id}`, type: "my_note", id: n._id, title: n.title, meta: n.template ? `template: ${n.template}` : "personal note" });
    for (const b of boards ?? [])
      rows.push({ key: `wb:${b._id}`, type: "whiteboard", id: b._id, title: b.title, meta: `${b.elements.length} elements` });
    return rows;
  }, [notes, myNotes, boards]);

  const filtered = materials
    .filter((m) => m.type === tab)
    .filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()));

  const loading = notes === undefined || myNotes === undefined || boards === undefined;

  const handleSend = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      // 1) Create the secure share row (server validates ownership + access).
      const shareId = await share({
        targetType: selected.type,
        targetId: selected.id,
        conversationId: conversationId as never,
      });
      // 2) Send the chat message that carries the share card.
      const body = message.trim() || `Shared "${selected.title}" with you!`;
      await sendMessage({
        conversationId: conversationId as never,
        body,
        shareId: shareId as never,
      });
      sounds.success();
      toast.success("Material shared 🎉");
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not share material.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl border bg-background sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="flex-1 text-sm font-bold">Share study material</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 overflow-x-auto border-b px-3 py-2">
          {(["ai_note", "my_note", "whiteboard", "quiz"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {TYPE_META[t].emoji} {TYPE_META[t].label}s
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${TYPE_META[tab].label.toLowerCase()}s…`}
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="annotation py-8 text-center text-sm">
              No {TYPE_META[tab].label.toLowerCase()}s found.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((m) => (
                <li key={m.key}>
                  <button
                    onClick={() => setSelected(m)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      selected?.key === m.key ? "border-primary bg-primary/5" : "hover:bg-accent",
                    )}
                  >
                    <span className="text-lg">{TYPE_META[m.type].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.title}</span>
                      <span className="annotation block truncate text-[10px]">{m.meta}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compose + send */}
        <div className="border-t p-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add an optional message…"
            rows={2}
            maxLength={500}
            className="mb-2 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none"
          />
          <Button
            className="w-full"
            disabled={!selected || busy}
            onClick={handleSend}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
            {selected ? `Send "${selected.title.slice(0, 24)}${selected.title.length > 24 ? "…" : ""}"` : "Select a material"}
          </Button>
          <p className="annotation mt-2 flex items-center justify-center gap-1 text-center text-[10px]">
            <ScrollText className="size-3" /> They'll get a read-only card — Save a copy to edit.
          </p>
        </div>
      </div>
    </div>
  );
}
