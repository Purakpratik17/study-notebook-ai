import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  BookmarkCheck,
  Camera,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSounds } from "@/hooks/use-settings";
import TutorChat from "./TutorChat";

/** Shrink a picture to a small JPEG data URL so it fits in Convex documents. */
async function shrinkImage(file: File, maxDim = 1100, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export default function SnapSolve() {
  const sounds = useSounds();
  const solveAction = useAction(api.tutor.solve);
  const saveMutation = useMutation(api.tutor.saveQuestion);
  const unsaveMutation = useMutation(api.tutor.unsaveQuestion);

  const [image, setImage] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  const session = useQuery(
    api.tutor.get,
    sessionId ? { sessionId: sessionId as never } : "skip",
  );

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      setImage(dataUrl);
      sounds.click();
    } catch {
      toast.error("Could not read that image. Try another one.");
    }
  };

  const solve = async () => {
    if (loading) return;
    if (!image && questionText.trim().length < 2) {
      toast.error("Snap a photo or type the question first.");
      return;
    }
    setLoading(true);
    sounds.click();
    try {
      const result = await solveAction({
        image: image ?? undefined,
        questionText: questionText.trim() || undefined,
        subject: subject.trim() || undefined,
      });
      setSessionId(result.sessionId);
      sounds.success();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message.replace(/^UNAUTHENTICATED:\s*/, "")
          : "Could not solve that. Please try again.",
      );
      sounds.incorrect();
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSessionId(null);
    setImage(null);
    setQuestionText("");
  };

  const saved = useQuery(api.tutor.savedList, {});
  const isSaved = (sid: string) =>
    !!saved?.some((s) => s.tutorSessionId === sid);

  const toggleSave = async () => {
    if (!sessionId) return;
    try {
      if (isSaved(sessionId)) {
        const row = saved!.find((s) => s.tutorSessionId === sessionId)!;
        await unsaveMutation({ id: row._id });
        toast("Removed from saved questions");
      } else {
        await saveMutation({
          source: "snap",
          subject: subject.trim() || undefined,
          topic: session?.topic ?? undefined,
          question: session?.questionText?.slice(0, 300) || "Photo question",
          answer: session?.solution.slice(0, 2000),
          tutorSessionId: sessionId as never,
        });
        toast.success("Saved to your questions");
      }
      sounds.success();
    } catch {
      toast.error("Could not save that question.");
    }
  };

  /* ── Solved view ── */
  if (sessionId && session) {
    return (
      <section className="paper-sheet spiral-edge flex flex-col gap-4 px-5 py-4 md:px-7">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold">Solution</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSave}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {isSaved(sessionId) ? (
                <>
                  <BookmarkCheck className="size-3.5 text-primary" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="size-3.5" /> Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <X className="size-3.5" /> New
            </button>
          </div>
        </div>
        {image && (
          <img
            src={image}
            alt="Your question"
            className="max-h-48 w-auto self-start rounded-md border border-border/60"
          />
        )}
        <TutorChat
          sessionId={sessionId}
          solution={session.solution}
          followUps={session.messages}
        />
      </section>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <section className="paper-sheet paper-margin flex flex-col items-center gap-3 px-5 py-12 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="font-semibold">Working through your question…</p>
        <p className="annotation text-xs">step-by-step solutions take a few seconds</p>
      </section>
    );
  }

  /* ── Input view ── */
  return (
    <section className="paper-sheet spiral-edge flex flex-col gap-4 px-5 py-4 md:px-7">
      <h3 className="text-base font-bold">Snap a question</h3>
      <p className="annotation text-xs">
        Take a photo of any problem or upload one from your gallery — Learnova solves it
        step by step.
      </p>

      {image ? (
        <div className="relative w-fit">
          <img
            src={image}
            alt="Selected question"
            className="max-h-56 rounded-md border border-border/60"
          />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow"
            aria-label="Remove image"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background/60 p-4 transition-colors hover:bg-accent"
          >
            <Camera className="size-6 text-primary" />
            <span className="text-sm font-semibold">Snap a question</span>
            <span className="annotation text-[11px]">use your camera</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background/60 p-4 transition-colors hover:bg-accent"
          >
            <ImageIcon className="size-6 text-primary" />
            <span className="text-sm font-semibold">Upload from gallery</span>
            <span className="annotation text-[11px]">pick a photo</span>
          </button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Or type the question here…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 sm:w-44"
        />
      </div>

      <button
        type="button"
        onClick={solve}
        disabled={loading || (!image && questionText.trim().length < 2)}
        className="rounded-lg bg-primary px-5 py-3.5 text-base font-bold text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {loading ? "Solving…" : "Solve it"}
      </button>
    </section>
  );
}
