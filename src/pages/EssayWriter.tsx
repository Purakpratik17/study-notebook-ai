import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  Loader2,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LENGTHS = ["300 words", "500 words", "800 words", "1200 words", "2000 words"];
const LEVELS = ["School", "High school", "College", "University"];
const TONES = ["Formal", "Simple", "Persuasive", "Analytical", "Descriptive"];
const MODES = [
  { id: "expand", label: "Expand" },
  { id: "shorten", label: "Shorten" },
  { id: "simplify", label: "Simplify" },
  { id: "formal", label: "More formal" },
  { id: "regenerate", label: "Regenerate" },
] as const;

export default function EssayWriter() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [length, setLength] = useState(LENGTHS[1]);
  const [level, setLevel] = useState(LEVELS[1]);
  const [tone, setTone] = useState(TONES[0]);
  const [keyPoints, setKeyPoints] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const generate = useAction(api.essays.generate);
  const revise = useAction(api.essays.revise);
  const updateContent = useMutation(api.essays.updateContent);
  const library = useQuery(api.essays.list);

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  const handleGenerate = async () => {
    if (topic.trim().length < 3 || loading) return;
    setLoading(true);
    setSavedId(null);
    try {
      const result = await generate({ topic, subject: subject || undefined, length, level, tone, keyPoints: keyPoints || undefined });
      setTitle(result.title);
      setContent(result.content);
      setSavedId(result.essayId);
      toast.success("Essay ready! ✍️");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevise = async (m: (typeof MODES)[number]["id"]) => {
    if (!content || loading) return;
    setLoading(true);
    setMode(m);
    try {
      const result = await revise({
        mode: m,
        title,
        topic,
        subject: subject || undefined,
        level,
        current: content,
      });
      setTitle(result.title);
      setContent(result.content);
      toast.success(`Essay ${m === "regenerate" ? "regenerated" : m + "d"} ✨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revision failed. Try again.");
    } finally {
      setLoading(false);
      setMode(null);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${content}`);
    setCopied(true);
    toast.success("Essay copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdits = async () => {
    if (!savedId) return;
    try {
      await updateContent({ essayId: savedId as never, content });
      toast.success("Changes saved");
    } catch {
      toast.error("Could not save changes");
    }
  };

  const inputCls =
    "h-11 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 transition focus:ring-2";
  const chip = (active: boolean) =>
    cn(
      "min-h-10 rounded-lg border px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97]",
      active ? "border-primary bg-primary/15 text-primary" : "bg-card hover:bg-accent",
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <PenLine className="size-7 text-primary" /> Essay Writer
        </h1>
        <p className="annotation text-sm">
          describe it once — get a structured essay you can tweak, expand or copy
        </p>
        <p className="mt-1 w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
          A great essay starts with a single draft. ✍️
        </p>
      </header>

      <form
        className="paper-sheet paper-margin px-5 py-5 md:pl-16"
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate();
        }}
      >
        <label className="text-sm font-semibold" htmlFor="topic">Essay topic</label>
        <input
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder='e.g. "The impact of social media on students"'
          className={cn(inputCls, "mt-2 h-14 text-base")}
          maxLength={150}
          disabled={loading}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="subject">Subject</label>
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="History, Biology…" className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="keys">Key points (optional)</label>
            <input id="keys" value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} placeholder="causes, effects, examples…" className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Length</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LENGTHS.map((l) => (
              <button key={l} type="button" onClick={() => setLength(l)} className={chip(length === l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm font-semibold">Level</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)} className={chip(level === l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm font-semibold">Tone / style</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)} className={chip(tone === t)}>{t}</button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || topic.trim().length < 3}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {loading ? "Writing your essay…" : "Write My Essay"}
        </button>
      </form>

      {loading && (
        <section className="paper-sheet flex items-center gap-3 px-5 py-6">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="annotation text-sm">drafting, structuring and polishing…</p>
        </section>
      )}

      {content && !loading && (
        <article className="paper-sheet spiral-edge px-5 py-6 md:px-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-xl font-bold tracking-tight outline-none md:text-2xl"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-semibold text-ink-soft">
              {wordCount} words
            </span>
            <button onClick={handleCopy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-semibold transition hover:bg-accent">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
            </button>
            {savedId && (
              <button onClick={handleSaveEdits} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-semibold transition hover:bg-accent">
                <Check className="size-3.5" /> Save edits
              </button>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className="mt-4 w-full resize-y rounded-lg border bg-background/50 p-4 text-sm leading-relaxed outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleRevise(m.id)}
                disabled={loading}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border bg-highlight-soft/60 px-3.5 text-sm font-semibold transition hover:bg-highlight/70 disabled:opacity-50"
              >
                <Wand2 className="size-3.5" /> {m.label}
              </button>
            ))}
          </div>
        </article>
      )}

      {library !== undefined && library.length > 0 && (
        <section className="paper-sheet spiral-edge px-5 py-4 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <BookOpen className="size-4" /> Your essays
          </h2>
          <ul className="ruled-list mt-2 flex flex-col">
            {library.map((e) => (
              <li key={e._id} className="flex items-center justify-between gap-3 py-2.5">
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => {
                    setTitle(e.title);
                    setContent(e.content);
                    setTopic(e.topic);
                    setSavedId(e._id);
                  }}
                >
                  <FileText className="size-4 shrink-0 text-marker" />
                  <span className="truncate text-sm hover:text-primary">{e.title}</span>
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">{e.wordCount} words</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
