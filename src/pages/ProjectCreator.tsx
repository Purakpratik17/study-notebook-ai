import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BookMarked,
  Check,
  Copy,
  FileStack,
  GraduationCap,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Section = { id: string; kind: string; heading: string; body: string };

const PAGE_SIZES = [5, 8, 12, 15, 20, 25];

export default function ProjectCreator() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [course, setCourse] = useState("");
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [institution, setInstitution] = useState("");
  const [teacher, setTeacher] = useState("");
  const [pages, setPages] = useState(8);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const generate = useAction(api.projects.generate);
  const regenerateSection = useAction(api.projects.regenerateSection);
  const updateSection = useMutation(api.projects.updateSection);
  const addSection = useMutation(api.projects.addSection);
  const removeSection = useMutation(api.projects.removeSection);
  const library = useQuery(api.projects.list);

  const inputCls =
    "h-11 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none ring-ring/40 transition focus:ring-2";

  const handleGenerate = async () => {
    if (topic.trim().length < 3 || loading) return;
    setLoading(true);
    try {
      const result = await generate({
        topic,
        subject: subject || "General Studies",
        course: course || undefined,
        studentName: studentName || undefined,
        rollNumber: rollNumber || undefined,
        institution: institution || undefined,
        teacher: teacher || undefined,
        pages,
        instructions: instructions || undefined,
      });
      setProjectId(result.projectId);
      setSections(result.sections);
      setTitle(result.title);
      toast.success("Project generated! 📚");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegen = async (sectionId: string) => {
    if (!projectId || regenId) return;
    setRegenId(sectionId);
    try {
      const result = await regenerateSection({ projectId: projectId as never, sectionId });
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, body: result.body } : s)));
      toast.success("Section regenerated ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenId(null);
    }
  };

  const saveEdit = async (sectionId: string) => {
    if (!projectId) return;
    try {
      await updateSection({ projectId: projectId as never, sectionId, body: draft });
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, body: draft } : s)));
      setEditingId(null);
      toast.success("Section saved");
    } catch {
      toast.error("Could not save section");
    }
  };

  const handleAdd = async (afterId: string) => {
    if (!projectId) return;
    try {
      const id = await addSection({ projectId: projectId as never, afterId, heading: "New Section" });
      setSections((prev) => {
        const idx = prev.findIndex((s) => s.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, { id, kind: "text", heading: "New Section", body: "(Write your content here, or tap Regenerate.)" });
        return next;
      });
      setEditingId(id);
      setDraft("(Write your content here, or tap Regenerate.)");
    } catch {
      toast.error("Could not add section");
    }
  };

  const handleRemove = async (sectionId: string) => {
    if (!projectId) return;
    try {
      await removeSection({ projectId: projectId as never, sectionId });
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      toast.success("Section removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove section");
    }
  };

  const copyAll = async () => {
    const text = `${title}\n\n${sections.map((s) => `${s.heading.toUpperCase()}\n${s.body}`).join("\n\n")}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Project copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const front = sections.find((s) => s.kind === "front");
  const rest = sections.filter((s) => s.kind !== "front");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <FileStack className="size-7 text-primary" /> Project Creator
        </h1>
        <p className="annotation text-sm">
          full assignment structure — front page to bibliography, editable section by section
        </p>
        <p className="mt-1 w-fit -rotate-1 rounded-md border border-dashed border-highlight/60 bg-highlight-soft/50 px-3 py-1.5 text-sm text-foreground/80">
          Your project, properly presented. 📚
        </p>
      </header>

      <form
        className="paper-sheet paper-margin px-5 py-5 md:pl-16"
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate();
        }}
      >
        <label className="text-sm font-semibold" htmlFor="ptopic">Project topic</label>
        <input id="ptopic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder='e.g. "Renewable Energy in India"' className={cn(inputCls, "mt-2 h-14 text-base")} maxLength={150} disabled={loading} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="psub">Subject</label>
            <input id="psub" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics, Business Studies…" className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="pcourse">Class / Course (optional)</label>
            <input id="pcourse" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Class 10 / BBA 2nd Year" className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="pname">Student name (optional)</label>
            <input id="pname" value={studentName} onChange={(e) => setStudentName(e.target.value)} className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="proll">Roll number (optional)</label>
            <input id="proll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="pinst">College / school (optional)</label>
            <input id="pinst" value={institution} onChange={(e) => setInstitution(e.target.value)} className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="pteacher">Teacher (optional)</label>
            <input id="pteacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} className={cn(inputCls, "mt-1.5")} disabled={loading} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Desired pages</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PAGE_SIZES.map((p) => (
              <button key={p} type="button" onClick={() => setPages(p)} disabled={loading}
                className={cn("min-h-10 rounded-lg border px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97]", pages === p ? "border-primary bg-primary/15 text-primary" : "bg-card hover:bg-accent")}>
                {p} pages
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-sm font-semibold" htmlFor="pinstr">Specific instructions (optional)</label>
          <textarea id="pinstr" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="anything the teacher asked for…" className="mt-1.5 w-full rounded-lg border bg-background/60 p-3 text-sm outline-none ring-ring/40 focus:ring-2" disabled={loading} />
        </div>

        <button type="submit" disabled={loading || topic.trim().length < 3} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:px-8">
          {loading ? <Loader2 className="size-5 animate-spin" /> : <GraduationCap className="size-5" />}
          {loading ? "Building your project…" : "Generate Project"}
        </button>
        {loading && <p className="annotation mt-3 text-xs">writing sections — this can take a minute or two</p>}
      </form>

      {loading && (
        <section className="paper-sheet flex items-center gap-3 px-5 py-6">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="annotation text-sm">front page, chapters, tables and bibliography…</p>
        </section>
      )}

      {sections.length > 0 && !loading && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowPreview((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition hover:bg-accent">
              <BookMarked className="size-4" /> {showPreview ? "Edit view" : "Preview project"}
            </button>
            <button onClick={copyAll} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition hover:bg-accent">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy all
            </button>
            <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition hover:bg-accent">
              <Printer className="size-4" /> Print / PDF
            </button>
          </div>

          {showPreview ? (
            <article className="paper-sheet spiral-edge px-6 py-8 md:px-10">
              <p className="annotation text-sm">project preview</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
              {sections.map((s) => (
                <section key={s.id} className="mt-6">
                  <h3 className={cn("font-bold", s.kind === "front" ? "text-lg" : "text-base uppercase tracking-wide text-ink-soft")}>{s.heading}</h3>
                  <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{s.body}</div>
                </section>
              ))}
            </article>
          ) : (
            <>
              {front && (
                <FrontPageCard section={front} onRegen={handleRegen} regenId={regenId} />
              )}
              <p className="annotation px-1 text-xs">tip: front page is rendered like a real assignment cover</p>
              {rest.map((s) => (
                <article key={s.id} className="paper-sheet px-5 py-5 md:px-7">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={s.heading}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, heading: v } : x)));
                      }}
                      onBlur={async () => {
                        if (projectId) await updateSection({ projectId: projectId as never, sectionId: s.id, body: s.body, heading: s.heading });
                      }}
                      className="min-w-0 flex-1 bg-transparent text-lg font-bold tracking-tight outline-none"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <button title="Regenerate" onClick={() => handleRegen(s.id)} disabled={regenId !== null} className="rounded-lg p-2 hover:bg-accent disabled:opacity-50">
                        {regenId === s.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      </button>
                      <button title="Add section after" onClick={() => handleAdd(s.id)} className="rounded-lg p-2 hover:bg-accent">
                        <Plus className="size-4" />
                      </button>
                      <button title="Remove section" onClick={() => handleRemove(s.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {editingId === s.id ? (
                    <>
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="mt-3 w-full rounded-lg border bg-background/50 p-3 text-sm leading-relaxed outline-none" />
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => saveEdit(s.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">Save</button>
                        <button onClick={() => setEditingId(null)} className="inline-flex min-h-9 items-center rounded-lg border bg-card px-3 text-xs font-semibold">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(s.id); setDraft(s.body); }} className="mt-2 block w-full whitespace-pre-wrap rounded-lg text-left text-sm leading-relaxed hover:bg-accent/30">
                      {s.body}
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
        </>
      )}

      {library !== undefined && library.length > 0 && sections.length === 0 && (
        <section className="paper-sheet spiral-edge px-5 py-4 md:px-7">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <FileStack className="size-4" /> Your projects
          </h2>
          <ul className="ruled-list mt-2 flex flex-col">
            {library.map((p) => (
              <li key={p._id} className="py-2.5 text-sm hover:text-primary">
                <button onClick={() => { setProjectId(p._id); setSections(p.sections); setTitle(p.title); }} className="truncate text-left">{p.title}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FrontPageCard({ section, onRegen, regenId }: { section: Section; onRegen: (id: string) => void; regenId: string | null }) {
  const fields = section.body.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <article className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-highlight-soft/70 via-paper to-paper-deep px-6 py-10 text-center shadow-md">
      <div className="pointer-events-none absolute inset-0 border-[6px] border-double border-primary/20" />
      {fields.map((line, i) => {
        const [label, ...value] = line.split(":");
        const isTitle = /^title$/i.test(label);
        return (
          <p key={i} className={cn("py-1", isTitle ? "text-xl font-black tracking-tight md:text-3xl" : "text-sm md:text-base")}>
            {isTitle ? value.join(":").trim() : (
              <>
                <span className="font-semibold text-ink-soft">{label}:{value.length > 0 && " "}</span>
                <span className="font-bold">{value.join(":").trim()}</span>
              </>
            )}
          </p>
        );
      })}
      <button onClick={() => onRegen(section.id)} disabled={regenId !== null} className="relative mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-accent disabled:opacity-50">
        {regenId === section.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Regenerate
      </button>
    </article>
  );
}
