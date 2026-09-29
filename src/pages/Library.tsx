import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  FolderInput,
  FolderPlus,
  Library as LibraryIcon,
  Palette,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

import { useMemo, useState } from "react";
import { Link } from "react-router";
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

/* ═══════════════════════════════════════════════════════════════════════
   STUDY LIBRARY — one centralized, searchable view of every study
   material: AI notes, personal notes, whiteboards and quizzes. Supports
   folder organization (references, never copies), rename, duplicate,
   delete and move.
   ═══════════════════════════════════════════════════════════════════════ */

type MaterialType = "ai_note" | "my_note" | "whiteboard" | "quiz";
type SortKey = "recent" | "name";

type MaterialRow = {
  key: string; // `${type}:${id}`
  type: MaterialType;
  id: string;
  title: string;
  updatedAt: number;
  folderId: string | null;
  meta: string;
}

const folderIdOf = (n: Record<string, unknown>): string | null =>
  typeof n.folderId === "string" ? n.folderId : null;;

const TYPE_LABEL: Record<MaterialType, string> = {
  ai_note: "AI Note",
  my_note: "My Note",
  whiteboard: "Whiteboard",
  quiz: "Quiz",
};

export default function Library() {
  const sounds = useSounds();
  const folders = useQuery(api.folders.list);
  const notes = useQuery(api.notes.list);
  const myNotes = useQuery(api.myNotes.list);
  const boards = useQuery(api.whiteboards.list);

  const createFolder = useMutation(api.folders.create);
  const renameFolder = useMutation(api.folders.rename);
  const deleteFolder = useMutation(api.folders.remove);

  const renameNote = useMutation(api.notes.rename);
  const dupNote = useMutation(api.notes.duplicate);
  const delNote = useMutation(api.notes.remove);
  const moveNote = useMutation(api.notes.setFolder);

  const renameMyNote = useMutation(api.myNotes.rename);
  const dupMyNote = useMutation(api.myNotes.duplicate);
  const delMyNote = useMutation(api.myNotes.remove);
  const moveMyNote = useMutation(api.myNotes.setFolder);

  const renameBoard = useMutation(api.whiteboards.rename);
  const dupBoard = useMutation(api.whiteboards.duplicate);
  const delBoard = useMutation(api.whiteboards.remove);
  const moveBoard = useMutation(api.whiteboards.setFolder);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [typeFilter, setTypeFilter] = useState<MaterialType | "all">("all");
  const [folderFilter, setFolderFilter] = useState<string | "all" | "none">("all");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveTarget, setMoveTarget] = useState<MaterialRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<MaterialRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MaterialRow | null>(null);

  const loading =
    folders === undefined || notes === undefined || myNotes === undefined || boards === undefined;

  const materials: MaterialRow[] = useMemo(() => {
    const rows: MaterialRow[] = [];
    for (const n of notes ?? []) {
      rows.push({
        key: `ai_note:${n._id}`,
        type: "ai_note",
        id: n._id,
        title: n.topic,
        updatedAt: n.createdAt,
        folderId: folderIdOf(n),
        meta: `${n.quizCount} quiz questions`,
      });
      // Each AI note's embedded quiz is surfaced as a separate entry.
      if (n.quizCount > 0) {
        rows.push({
          key: `quiz:${n._id}`,
          type: "quiz",
          id: n._id,
          title: `Quiz — ${n.topic}`,
          updatedAt: n.createdAt,
          folderId: folderIdOf(n),
          meta: `${n.quizCount} questions`,
        });
      }
    }
    for (const n of myNotes ?? []) {
      rows.push({
        key: `my_note:${n._id}`,
        type: "my_note",
        id: n._id,
        title: n.title,
        updatedAt: n.updatedAt,
        folderId: n.folderId ?? null,
        meta: n.template ? `template: ${n.template}` : "personal note",
      });
    }
    for (const b of boards ?? []) {
      rows.push({
        key: `whiteboard:${b._id}`,
        type: "whiteboard",
        id: b._id,
        title: b.title,
        updatedAt: b.updatedAt,
        folderId: folderIdOf(b),
        meta: `${b.elements.length} element${b.elements.length === 1 ? "" : "s"}`,
      });
    }
    return rows;
  }, [notes, myNotes, boards]);

  const visible = useMemo(() => {
    let rows = [...materials];
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    if (folderFilter === "none") rows = rows.filter((r) => !r.folderId);
    else if (folderFilter !== "all") rows = rows.filter((r) => r.folderId === folderFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    rows.sort((a, b) =>
      sort === "name" ? a.title.localeCompare(b.title) : b.updatedAt - a.updatedAt,
    );
    return rows;
  }, [materials, search, sort, typeFilter, folderFilter]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder({ name });
      setNewFolderName("");
      setFolderDialogOpen(false);
      sounds.success();
      toast.success(`Folder “${name}” created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create folder");
    }
  };

  const handleRenameFolder = async (id: string, current: string) => {
    const name = window.prompt("Rename folder:", current);
    if (!name?.trim() || name === current) return;
    try {
      await renameFolder({ id: id as never, name });
      toast.success("Folder renamed");
    } catch {
      toast.error("Could not rename folder");
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Delete folder “${name}”?\n\nThe materials inside are NOT deleted — they become unfiled and stay in your library.`,
      )
    )
      return;
    try {
      await deleteFolder({ id: id as never });
      if (folderFilter === id) setFolderFilter("all");
      sounds.success();
      toast.success("Folder deleted — materials kept");
    } catch {
      toast.error("Could not delete folder");
    }
  };

  const doRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    try {
      if (renameTarget.type === "ai_note" || renameTarget.type === "quiz")
        await renameNote({ noteId: renameTarget.id as never, topic: title });
      else if (renameTarget.type === "my_note")
        await renameMyNote({ id: renameTarget.id as never, title });
      else await renameBoard({ id: renameTarget.id as never, title });
      sounds.success();
      toast.success("Renamed");
      setRenameTarget(null);
    } catch {
      toast.error("Could not rename");
    }
  };

  const doDuplicate = async (row: MaterialRow) => {
    try {
      if (row.type === "ai_note" || row.type === "quiz")
        await dupNote({ noteId: row.id as never });
      else if (row.type === "my_note") await dupMyNote({ id: row.id as never });
      else await dupBoard({ id: row.id as never });
      sounds.success();
      toast.success("Copy created");
    } catch {
      toast.error("Could not duplicate");
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "ai_note" || deleteTarget.type === "quiz")
        await delNote({ noteId: deleteTarget.id as never });
      else if (deleteTarget.type === "my_note")
        await delMyNote({ id: deleteTarget.id as never });
      else await delBoard({ id: deleteTarget.id as never });
      sounds.success();
      toast.success("Deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete");
    }
  };

  const doMove = async (folderId: string | null) => {
    if (!moveTarget) return;
    try {
      if (moveTarget.type === "ai_note" || moveTarget.type === "quiz")
        await moveNote({ noteId: moveTarget.id as never, folderId: folderId as never });
      else if (moveTarget.type === "my_note")
        await moveMyNote({ id: moveTarget.id as never, folderId: folderId as never });
      else await moveBoard({ id: moveTarget.id as never, folderId: folderId as never });
      toast.success(folderId ? "Moved to folder" : "Removed from folder");
      setMoveTarget(null);
    } catch {
      toast.error("Could not move");
    }
  };

  const openLink = (row: MaterialRow) => {
    if (row.type === "ai_note" || row.type === "quiz") return `/ai-study?note=${row.id}`;
    if (row.type === "my_note") return `/my-notes?note=${row.id}`;
    return `/whiteboard`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <LibraryIcon className="size-7 text-primary" /> Study Library
          </h1>
          <p className="annotation text-sm">
            every note, board and quiz — organized your way
          </p>
        </div>
        <Button onClick={() => { sounds.click(); setFolderDialogOpen(true); }}>
          <FolderPlus className="size-4" /> New folder
        </Button>
      </header>

      {/* Folders strip */}
      <section className="flex flex-wrap gap-2">
        {folders === undefined ? (
          <div className="shimmer h-9 w-full rounded-lg" />
        ) : (
          folders.map((f) => (
            <span
              key={f._id}
              className={cn(
                "group inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold",
                folderFilter === f._id ? "bg-primary text-primary-foreground" : "bg-background",
              )}
            >
              <button
                onClick={() => { sounds.click(); setFolderFilter(folderFilter === f._id ? "all" : f._id); }}
              >
                {f.name}
              </button>
              <button
                aria-label={`Rename ${f.name}`}
                onClick={() => handleRenameFolder(f._id, f.name)}
                className="opacity-40 transition group-hover:opacity-100"
              >
                <Pencil className="size-3" />
              </button>
              <button
                aria-label={`Delete ${f.name}`}
                onClick={() => handleDeleteFolder(f._id, f.name)}
                className="opacity-40 transition group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))
        )}
        {folderFilter !== "all" && (
          <button
            onClick={() => setFolderFilter("all")}
            className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
          >
            clear filter
          </button>
        )}
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-40 flex-1 items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="h-10 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as MaterialType | "all")}
          className="h-10 rounded-lg border bg-background px-2 text-sm"
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="ai_note">AI Notes</option>
          <option value="my_note">My Notes</option>
          <option value="whiteboard">Whiteboards</option>
          <option value="quiz">Quizzes</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-lg border bg-background px-2 text-sm"
          aria-label="Sort"
        >
          <option value="recent">Most recent</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingNotebook className="scale-75" />
        </div>
      ) : visible.length === 0 ? (
        <div className="paper-sheet flex flex-col items-center gap-2 px-6 py-12 text-center">
          <LibraryIcon className="size-8 text-ink-faint" />
          <p className="font-semibold">Nothing here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Generate AI notes, write personal notes, sketch a whiteboard or
            take a quiz — everything lands in this library automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <div
              key={row.key}
              className="card-3d group flex flex-col rounded-xl border bg-card p-4"
            >
              <Link to={openLink(row)} className="min-w-0 flex-1">
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {TYPE_LABEL[row.type]}
                </span>
                <p className="mt-2 truncate font-semibold">{row.title}</p>
                <p className="annotation mt-0.5 truncate text-xs">{row.meta}</p>
                <p className="annotation mt-1 text-[10px]">
                  {new Date(row.updatedAt).toLocaleDateString()}
                </p>
              </Link>
              <div className="mt-3 flex items-center gap-1 border-t pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Rename"
                  onClick={() => {
                    setRenameTarget(row);
                    setRenameValue(row.title);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Duplicate"
                  onClick={() => doDuplicate(row)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Move to folder"
                  onClick={() => setMoveTarget(row)}
                >
                  <FolderInput className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            placeholder="e.g. Biology — Term 2"
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doRename()}
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={doRename} disabled={!renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
          </DialogHeader>
          <p className="annotation text-xs">{moveTarget?.title}</p>
          <div className="flex flex-col gap-1">
            {folders?.length === 0 && (
              <p className="annotation py-2 text-center text-xs">
                No folders yet — create one first.
              </p>
            )}
            {folders?.map((f) => (
              <button
                key={f._id}
                onClick={() => doMove(f._id)}
                className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-accent"
              >
                <FolderInput className="size-4 text-primary" /> {f.name}
              </button>
            ))}
            {moveTarget?.folderId && (
              <button
                onClick={() => doMove(null)}
                className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground hover:bg-accent"
              >
                Remove from folder
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete material?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{deleteTarget?.title}” will be permanently deleted. This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
