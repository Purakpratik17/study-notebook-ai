import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import {
  BookOpen,
  Footprints,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  Send,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";

type TutorAction = "simple" | "steps" | "example" | "previous" | "hint";

const ACTIONS: Array<{ id: TutorAction; label: string; icon: typeof Lightbulb }> = [
  { id: "simple", label: "Explain simply", icon: BookOpen },
  { id: "steps", label: "Step by step", icon: Footprints },
  { id: "example", label: "Give an example", icon: MessageCircleQuestion },
  { id: "previous", label: "Explain previous step", icon: Undo2 },
  { id: "hint", label: "Give me a hint", icon: Lightbulb },
];

export default function TutorChat({
  sessionId,
  solution,
  followUps,
  onAnswered,
}: {
  sessionId: string;
  solution: string;
  followUps: Array<{ role: "user" | "assistant"; content: string }>;
  /** Called after each new tutor reply (lets parents persist state). */
  onAnswered?: () => void;
}) {
  const sounds = useSounds();
  const followUpAction = useAction(api.tutor.followUp);
  const tutorActionFn = useAction(api.tutor.tutorAction);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [followUps.length, busy]);

  const send = async (text: string) => {
    if (busy || !text.trim()) return;
    setBusy(true);
    sounds.click();
    try {
      await followUpAction({ sessionId: sessionId as never, message: text });
      sounds.success();
      onAnswered?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The tutor could not respond.");
      sounds.incorrect();
    } finally {
      setBusy(false);
    }
  };

  const preset = async (id: TutorAction) => {
    if (busy) return;
    setBusy(true);
    sounds.click();
    try {
      await tutorActionFn({ sessionId: sessionId as never, action: id });
      sounds.success();
      onAnswered?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The tutor could not respond.");
      sounds.incorrect();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scrollRef}
        className="ruled-list flex max-h-80 flex-col overflow-y-auto rounded-md border border-border/60 bg-background/60 px-3 py-2"
      >
        <p className="whitespace-pre-wrap text-sm text-foreground/85">{solution}</p>
        {followUps.map((m, i) => (
          <div key={i} className="mt-3 border-t border-dashed border-border/60 pt-3">
            <p
              className={
                m.role === "user"
                  ? "text-sm font-semibold text-primary"
                  : "whitespace-pre-wrap text-sm text-foreground/85"
              }
            >
              {m.role === "user" ? `You: ${m.content}` : m.content}
            </p>
          </div>
        ))}
        {busy && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> The tutor is thinking…
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => preset(id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send
        </button>
      </form>
    </div>
  );
}
