import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  Download,
  FilePlus2,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSounds } from "@/hooks/use-settings";
import { LoadingNotebook } from "@/components/loading";
import { downloadNoteAsPdf } from "@/lib/pdf";

/* ═══════════════════════════════════════════════════════════════════════
   MY NOTES — self-created rich-text notes.

   The editor reuses the same contentEditable engine as the AI note
   editor (formatting toolbar + autosave). Freehand drawing, shapes and
   canvas work stay in the existing Whiteboard — one canvas system, no
   competing implementation. Templates set a starting structure.
   ═══════════════════════════════════════════════════════════════════════ */

const TEMPLATES: Record<string, { label: string; html: () => string }> = {
  blank: { label: "Blank", html: () => "<p><br></p>" },
  Cornell: {
    label: "Cornell notes",
    html: () =>
      "<h2>Cues</h2><ul><li>…</li></ul><h2>Notes</h2><p>…</p><h2>Summary</h2><p>…</p>",
  },
  Outline: {
    label: "Outline",
    html: () => "<h2>Main idea</h2><ol><li>Point one</li><li>Point two</li></ol>",
  },
  Summary: {
    label: "Summary sheet",
    html: () => "<h2>Topic</h2><p>One-paragraph summary…</p><h2>Key terms</h2><ul><li>term — meaning</li></ul>",
  },
};

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (name === "href" || name === "src") {
        const v = attr.value.trim().toLowerCase();
        if (v.startsWith("javascript:") || v.startsWith("data:text/html"))
          el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

export default function MyNotes() {
  const sounds = useSounds();
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useQuery(api.myNotes.list);
  const create = useMutation(api.myNotes.create);
  const save = useMutation(api.myNotes.save);
  const rename = useMutation(api.myNotes.rename);
  const duplicate = useMutation(api.myNotes.duplicate);
  const remove = useMutation(api.myNotes.remove);

  const activeId = searchParams.get("note");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const filtered = (notes ?? []).filter((n) =>
    n.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const handleCreate = async (template?: string) => {
    try {
      const id = await create({
        title: "Untitled note",
        template,
        content: template ? TEMPLATES[template]?.html() ?? "" : "",
      });
      sounds.success();
      setSearchParams({ note: id });
    } catch {
      toast.error("Could not create note");
    }
  };

  if (activeId) {
    return (
      <MyNoteEditor
        noteId={activeId}
        onBack={() => setSearchParams({})}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🗒️ My Notes</h1>
          <p className="annotation text-sm">
            write it your way — from scratch, your structure
          </p>
        </div>
        <Button onClick={() => handleCreate()}>
          <FilePlus2 className="size-4" /> New note
        </Button>
      </header>

      {/* Template quick-starts */}
      <section className="flex flex-wrap gap-2">
        {Object.entries(TEMPLATES)
          .filter(([k]) => k !== "blank")
          .map(([k, t]) => (
            <button
              key={k}
              onClick={() => { sounds.click(); void handleCreate(k); }}
              className="rounded-full border bg-highlight-soft/50 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-highlight/60"
            >
              ✨ {t.label}
            </button>
          ))}
      </section>

      <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {notes === undefined ? (
        <div className="flex justify-center py-16">
          <LoadingNotebook className="scale-75" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          <FilePlus2 className="size-8 text-ink-faint" />
          <p className="font-semibold">No notes yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first note — or start from a template above.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <div key={n._id} className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
              <button
                className="min-w-0 text-left"
                onClick={() => { sounds.click(); setSearchParams({ note: n._id }); }}
              >
                <p className="truncate font-semibold">{n.title}</p>
                <p className="annotation mt-0.5 line-clamp-2 text-xs">
                  {(n.content || "empty note").replace(/<[^>]*>/g, "").slice(0, 80) || "empty note"}
                </p>
                <p className="annotation mt-1 text-[10px]">
                  {new Date(n.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <div className="mt-3 flex items-center gap-1 border-t pt-2">
                <Button
                  variant="ghost" size="icon" className="size-8 text-muted-foreground"
                  aria-label="Duplicate"
                  onClick={async () => {
                    try { await duplicate({ id: n._id }); toast.success("Copy created"); }
                    catch { toast.error("Could not duplicate"); }
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => setDeleteTarget({ id: n._id, title: n.title })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{deleteTarget?.title}” will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                await remove({ id: deleteTarget.id as never });
                setDeleteTarget(null);
                toast.success("Deleted");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Editor ─────────────────────────────────────────────────────────── */

function MyNoteEditor({ noteId, onBack }: { noteId: string; onBack: () => void }) {
  const sounds = useSounds();
  const note = useQuery(api.myNotes.get, { id: noteId as never });
  const save = useMutation(api.myNotes.save);
  const rename = useMutation(api.myNotes.rename);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (note && loadedRef.current !== note._id) {
      loadedRef.current = note._id;
      if (editorRef.current) editorRef.current.innerHTML = note.content;
    }
  }, [note]);

  const scheduleSave = () => {
    dirtyRef.current = true;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await save({
          id: noteId as never,
          content: sanitizeHtml(editorRef.current?.innerHTML ?? ""),
        });
        dirtyRef.current = false;
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveState("idle");
        toast.error("Couldn't save — will retry on your next edit.");
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current && editorRef.current) {
        save({ id: noteId as never, content: sanitizeHtml(editorRef.current.innerHTML) })
          .catch(() => undefined);
      }
    };
  }, [noteId, save]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    scheduleSave();
  };

  if (note === undefined) {
    return <div className="flex justify-center py-16"><LoadingNotebook className="scale-75" /></div>;
  }
  if (note === null) {
    return (
      <div className="paper-sheet mx-auto mt-10 max-w-md px-6 py-10 text-center">
        <p className="font-semibold">Note not found</p>
        <button onClick={onBack} className="mt-3 text-sm text-primary hover:underline">
          ← Back to My Notes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => { sounds.click(); onBack(); }}>
          ← Notes
        </Button>
        <button
          className="min-w-0 max-w-[50%] truncate rounded px-2 py-1 text-lg font-bold hover:bg-accent"
          title="Click to rename"
          onClick={async () => {
            const t = window.prompt("Rename note:", note.title);
            if (t?.trim() && t !== note.title) {
              await rename({ id: noteId as never, title: t.trim() });
              toast.success("Renamed");
            }
          }}
        >
          {note.title}
        </button>
        <span className="annotation ml-auto text-xs">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "autosaves"}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void downloadNoteAsPdf(note.title, editorRef.current?.innerHTML ?? "")
          }
        >
          <Download className="size-4" /> PDF
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1.5">
        <button title="Bold" onClick={() => exec("bold")} className="rounded-lg p-2 hover:bg-accent" aria-label="Bold"><b className="text-sm">B</b></button>
        <button title="Italic" onClick={() => exec("italic")} className="rounded-lg p-2 hover:bg-accent" aria-label="Italic"><i className="text-sm">I</i></button>
        <button title="Underline" onClick={() => exec("underline")} className="rounded-lg p-2 hover:bg-accent" aria-label="Underline"><u className="text-sm">U</u></button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Heading" onClick={() => exec("formatBlock", "<h2>")} className="rounded-lg px-2 py-2 text-xs font-bold hover:bg-accent">H2</button>
        <button title="Paragraph" onClick={() => exec("formatBlock", "<p>")} className="rounded-lg px-2 py-2 text-xs font-bold hover:bg-accent">¶</button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Bulleted list" onClick={() => exec("insertUnorderedList")} className="rounded-lg p-2 hover:bg-accent" aria-label="List">• ≡</button>
        <button title="Numbered list" onClick={() => exec("insertOrderedList")} className="rounded-lg p-2 hover:bg-accent" aria-label="Numbered list">1. ≡</button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Undo" onClick={() => { document.execCommand("undo"); scheduleSave(); }} className="rounded-lg p-2 hover:bg-accent" aria-label="Undo">↶</button>
        <button title="Redo" onClick={() => { document.execCommand("redo"); scheduleSave(); }} className="rounded-lg p-2 hover:bg-accent" aria-label="Redo">↷</button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={scheduleSave}
        onBlur={scheduleSave}
        role="textbox"
        aria-multiline="true"
        aria-label="Note editor"
        className={cn(
          "paper-sheet paper-margin min-h-[60vh] px-5 py-6 pl-14 text-[15px] leading-relaxed outline-none md:px-8 md:pl-20",
          "[&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
          "[&_strong]:font-bold [&_em]:italic [&_u]:underline",
        )}
      />
    </div>
  );
}
