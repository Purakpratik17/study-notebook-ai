import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Bold,
  Download,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Save,
  Underline,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSounds } from "@/hooks/use-settings";
import { LoadingNotebook } from "@/components/loading";
import { downloadNoteAsPdf } from "@/lib/pdf";

/* ═══════════════════════════════════════════════════════════════════════
   AI NOTE EDITOR — rich-text editing of AI-generated notes.

   • The original AI content is NEVER modified: edits write exclusively to
     the note's `editedContent` field (see src/convex/notes.ts saveEdit).
     Editing can never trigger regeneration or clobber the source.
   • contentEditable-based toolbar: headings, bold/italic/underline,
     ordered/unordered lists — works with Android soft keyboards.
   • Debounced autosave with a visible save indicator.
   • document.execCommand is deprecated but remains the only cross-browser
     API that preserves native undo/redo and IME composition on mobile
     WebViews; undo/redo buttons fall back to the browser history stack.
   ═══════════════════════════════════════════════════════════════════════ */

type StudyNotes = {
  topic: string;
  intro: string;
  sections: Array<{
    heading: string;
    bullets: string[];
    highlight?: string;
  }>;
  keyPoints: string[];
  formulas: string[];
  examTips: string[];
  summary: string;
};

/** Convert the structured AI content to editable HTML (initial content). */
function aiToHtml(n: StudyNotes): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [];
  parts.push(`<h1>${esc(n.topic)}</h1>`);
  parts.push(`<p>${esc(n.intro)}</p>`);
  for (const s of n.sections) {
    parts.push(`<h2>${esc(s.heading)}</h2>`);
    parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    if (s.highlight) parts.push(`<p><strong>★ ${esc(s.highlight)}</strong></p>`);
  }
  if (n.keyPoints.length)
    parts.push(`<h2>Key exam points</h2><ul>${n.keyPoints.map((k) => `<li>✓ ${esc(k)}</li>`).join("")}</ul>`);
  if (n.formulas.length)
    parts.push(`<h2>Formulas</h2><ul>${n.formulas.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>`);
  if (n.examTips.length)
    parts.push(`<h2>Exam tips</h2><ul>${n.examTips.map((t) => `<li>💡 ${esc(t)}</li>`).join("")}</ul>`);
  if (n.summary) parts.push(`<h2>Summary</h2><p>${esc(n.summary)}</p>`);
  return parts.join("\n");
}

/** Basic HTML sanitizer — strips scripts, event handlers and javascript: URLs. */
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

export default function AiNoteEditor() {
  const { noteId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sounds = useSounds();

  const note = useQuery(api.notes.get, noteId ? { noteId: noteId as never } : "skip");
  const saveEdit = useMutation(api.notes.saveEdit);

  const [html, setHtml] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Initialize editor content once per note: prefer the user's edited
  // version, fall back to the original AI content converted to HTML.
  useEffect(() => {
    if (!note || html !== null) return;
    const initial =
      (note as { editedContent?: string }).editedContent ||
      aiToHtml(note.notes as unknown as StudyNotes);
    setHtml(initial);
    if (editorRef.current) editorRef.current.innerHTML = initial;
  }, [note, html]);

  const scheduleSave = useCallback(() => {
    if (!noteId) return;
    dirtyRef.current = true;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveEdit({ noteId: noteId as never, content: sanitizeHtml(editorRef.current?.innerHTML ?? "") });
        dirtyRef.current = false;
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveState("idle");
        toast.error("Couldn't save — will retry on your next edit.");
      }
    }, 1000);
  }, [noteId, saveEdit]);

  // Flush pending edits when leaving the page.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current && noteId && editorRef.current) {
        saveEdit({
          noteId: noteId as never,
          content: sanitizeHtml(editorRef.current.innerHTML),
        }).catch(() => undefined);
      }
    };
  }, [noteId, saveEdit]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    scheduleSave();
  };

  if (note === undefined) {
    return (
      <div className="flex justify-center py-16">
        <LoadingNotebook className="scale-75" />
      </div>
    );
  }
  if (note === null) {
    return (
      <div className="paper-sheet mx-auto mt-10 max-w-md px-6 py-10 text-center">
        <p className="font-semibold">Note not found</p>
        <Link to="/library" className="mt-3 inline-block text-sm text-primary hover:underline">
          ← Back to Library
        </Link>
      </div>
    );
  }

  const returnTo = searchParams.get("returnTo");
  const backLabel = returnTo?.startsWith("/") ? "Back" : "Library";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sounds.click();
            navigate(returnTo?.startsWith("/") ? returnTo : "/library");
          }}
        >
          <ArrowLeft className="size-4" /> {backLabel}
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{note.topic}</h1>
        <span className="annotation shrink-0 text-xs">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "autosaves"}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1.5">
        <button title="Bold" onClick={() => exec("bold")} className="rounded-lg p-2 hover:bg-accent" aria-label="Bold"><Bold className="size-4" /></button>
        <button title="Italic" onClick={() => exec("italic")} className="rounded-lg p-2 hover:bg-accent" aria-label="Italic"><Italic className="size-4" /></button>
        <button title="Underline" onClick={() => exec("underline")} className="rounded-lg p-2 hover:bg-accent" aria-label="Underline"><Underline className="size-4" /></button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Heading" onClick={() => exec("formatBlock", "<h2>")} className="rounded-lg px-2 py-2 text-xs font-bold hover:bg-accent">H2</button>
        <button title="Paragraph" onClick={() => exec("formatBlock", "<p>")} className="rounded-lg px-2 py-2 text-xs font-bold hover:bg-accent">¶</button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Bulleted list" onClick={() => exec("insertUnorderedList")} className="rounded-lg p-2 hover:bg-accent" aria-label="Bulleted list"><List className="size-4" /></button>
        <button title="Numbered list" onClick={() => exec("insertOrderedList")} className="rounded-lg p-2 hover:bg-accent" aria-label="Numbered list"><ListOrdered className="size-4" /></button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button title="Undo" onClick={() => { document.execCommand("undo"); scheduleSave(); }} className="rounded-lg p-2 hover:bg-accent" aria-label="Undo"><Undo2 className="size-4" /></button>
        <button title="Redo" onClick={() => { document.execCommand("redo"); scheduleSave(); }} className="rounded-lg p-2 hover:bg-accent" aria-label="Redo"><Redo2 className="size-4" /></button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void downloadNoteAsPdf(
              note.topic,
              editorRef.current?.innerHTML ?? "",
            )
          }
        >
          <Download className="size-4" /> PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            void saveEdit({ noteId: noteId as never, content: sanitizeHtml(editorRef.current?.innerHTML ?? "") })
              .then(() => { dirtyRef.current = false; setSaveState("saved"); toast.success("Saved"); })
              .catch(() => toast.error("Save failed"));
          }}
        >
          <Save className="size-4" /> Save now
        </Button>
      </div>

      {/* Editor surface */}
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
          "[&_code]:rounded [&_code]:bg-paper-deep [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm",
          "[&_strong]:font-bold [&_em]:italic",
        )}
      />

      <p className="annotation text-center text-xs">
        Your edits are stored separately — the original AI content is always preserved.
      </p>
    </div>
  );
}
