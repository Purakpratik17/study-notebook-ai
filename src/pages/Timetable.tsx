import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type Entry = {
  _id: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  completed: boolean;
};

function showXp(xp: { granted: boolean; amount: number; reason: string; totalXp: number; leveledUp: boolean; level: number; newLevelName: string | null } | null | undefined) {
  if (!xp) return;
  if (xp.granted) {
    toast.success(`+${xp.amount} XP — ${xp.reason}`);
  }
  if (xp.leveledUp) {
    toast.success(`Level up! You are now Level ${xp.level}${xp.newLevelName ? ` — ${xp.newLevelName}` : ""}`, {
      duration: 6000,
    });
  }
}

export default function Timetable() {
  const entries = useQuery(api.timetable.list) as Entry[] | undefined;
  const toggle = useMutation(api.timetable.toggleComplete);
  const create = useMutation(api.timetable.create);
  const remove = useMutation(api.timetable.remove);
  const [showForm, setShowForm] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const today = todayISO();
  const todays = (entries ?? []).filter((e) => e.date === today);
  const upcoming = (entries ?? [])
    .filter((e) => e.date > today)
    .slice(0, 20);
  const past = (entries ?? [])
    .filter((e) => e.date < today)
    .slice(-10)
    .reverse();

  const handleToggle = async (e: Entry) => {
    if (pendingId) return;
    setPendingId(e._id);
    try {
      const result = await toggle({ entryId: e._id as never });
      if (result.completed) {
        showXp(result.xp);
        for (const q of result.settledQuests ?? []) {
          toast.success(`Quest complete: ${q.title} (+${q.xp} XP)`);
        }
        toast.success("Task completed — nice work!", {
          description: e.subject,
        });
      } else {
        toast("Task reopened", { description: e.subject });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (e: Entry) => {
    try {
      await remove({ entryId: e._id as never });
      toast("Task removed", { description: e.subject });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove task");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="size-6 text-primary" /> Timetable
          </h1>
          <p className="annotation text-sm">plan it. do it. check it off.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <CalendarPlus className="size-4" />
          {showForm ? "Close" : "New study session"}
        </button>
      </header>

      {showForm && (
        <TaskForm
          onCreated={() => {
            setShowForm(false);
            toast.success("Study session added to your timetable");
          }}
        />
      )}

      {entries === undefined ? (
        <SkeletonList />
      ) : (
        <>
          <section className="paper-sheet paper-margin px-5 py-5 pl-14 md:px-7 md:pl-18">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Today — {fmtDate(today)}
            </h2>
            {todays.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-semibold">No timetable yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Create your first study session to start earning XP today.
                </p>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-semibold transition hover:bg-accent"
                  >
                    <CalendarPlus className="size-4" /> Create a study session
                  </button>
                )}
              </div>
            ) : (
              <ul className="ruled-list mt-2 flex flex-col">
                {todays.map((e) => (
                  <TaskRow
                    key={e._id}
                    entry={e}
                    pending={pendingId === e._id}
                    onToggle={() => handleToggle(e)}
                    onDelete={() => handleDelete(e)}
                  />
                ))}
              </ul>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="paper-sheet spiral-edge px-5 py-5 md:px-7">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                Coming up
              </h2>
              <ul className="ruled-list mt-2 flex flex-col">
                {upcoming.map((e) => (
                  <TaskRow
                    key={e._id}
                    entry={e}
                    showDate
                    pending={pendingId === e._id}
                    onToggle={() => handleToggle(e)}
                    onDelete={() => handleDelete(e)}
                  />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-faint">
                Earlier
              </h2>
              <ul className="mt-1 flex flex-col">
                {past.map((e) => (
                  <li
                    key={e._id}
                    className="flex items-center justify-between gap-3 border-b border-dashed py-2 text-sm text-muted-foreground last:border-0"
                  >
                    <span className={cn("truncate", e.completed && "line-through opacity-70")}>
                      {e.subject}
                    </span>
                    <span className="shrink-0 text-xs">
                      {fmtDate(e.date)} {e.completed ? "✓ done" : "· missed"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  entry,
  showDate = false,
  pending,
  onToggle,
  onDelete,
}: {
  entry: Entry;
  showDate?: boolean;
  pending: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <button
        role="checkbox"
        aria-checked={entry.completed}
        aria-label={`Mark ${entry.subject} as ${entry.completed ? "incomplete" : "complete"}`}
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded border-2 transition",
          entry.completed
            ? "border-xp bg-xp text-white animate-pop-in"
            : "border-ink-faint/60 bg-card hover:border-xp",
        )}
      >
        {entry.completed && <Check className="size-4" strokeWidth={3} />}
        {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            entry.completed && "text-muted-foreground line-through",
          )}
        >
          {entry.subject}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {showDate && <span>{fmtDate(entry.date)}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {entry.startTime}–{entry.endTime}
          </span>
          {entry.notes && <span className="truncate">· {entry.notes}</span>}
        </p>
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete ${entry.subject}`}
        className="shrink-0 rounded p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive md:opacity-0 md:transition md:group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function TaskForm({ onCreated }: { onCreated: () => void }) {
  const create = useMutation(api.timetable.create);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await create({
        subject,
        date,
        startTime,
        endTime,
        notes: notes || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the task");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-10 w-full rounded-md border bg-background/60 px-3 text-sm outline-none ring-ring/40 transition focus:ring-2";

  return (
    <form
      onSubmit={submit}
      className="paper-sheet spiral-edge px-5 py-4 md:px-7"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Subject / topic
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Calculus — derivatives"
            required
            maxLength={80}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Date
          </span>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Start
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              End
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Notes (optional)
          </span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Chapter 4, practice problems 1–10…"
            maxLength={140}
            className={inputCls}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving || !subject.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Add session
        </button>
      </div>
    </form>
  );
}

function SkeletonList() {
  return (
    <section className="paper-sheet px-5 py-6">
      <div className="flex flex-col gap-3">
        {[90, 75, 85].map((w, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
    </section>
  );
}
