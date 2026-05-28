"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/components/use-media-query";
import { noteTitle, type NoteInput } from "./note-card";

interface Props {
  /** Null when creating a fresh note. */
  note: NoteInput | null;
  /** Target stream for new notes. */
  createStreamId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: NoteInput) => void;
  onDeleted: (id: string) => void;
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 800;

export function NoteEditor({ note, createStreamId, open, onOpenChange, onSaved, onDeleted }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [body, setBody] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // We track persisted state in refs so the debounced save can read fresh
  // values without re-creating the timer on every keystroke.
  const persistedIdRef = React.useRef<string | null>(null);
  const persistedBodyRef = React.useRef("");
  const latestBodyRef = React.useRef("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = React.useRef(true);
  // True after we've initialised local state for the current open. Lets the
  // sync effect distinguish "first open" from "parent re-rendered us with a
  // fresher note prop because we just saved".
  const didInitForOpenRef = React.useRef(false);
  const createStreamIdRef = React.useRef(createStreamId);
  React.useEffect(() => {
    createStreamIdRef.current = createStreamId;
  }, [createStreamId]);

  React.useEffect(
    () => () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Tick once a minute so "saved 2m ago" stays fresh.
  const [, forceRerender] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceRerender((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [open]);

  // Sync state when the editor opens on a (possibly new) note. After the
  // first sync we don't reset from the `note` prop again: subsequent prop
  // changes are usually our own save round-tripping through the parent, and
  // re-syncing in that case would overwrite the characters the user just
  // typed (the "backspace while typing" bug).
  React.useEffect(() => {
    if (!open) {
      // Reset bookkeeping so the next open is a clean init.
      didInitForOpenRef.current = false;
      persistedIdRef.current = null;
      persistedBodyRef.current = "";
      latestBodyRef.current = "";
      return;
    }
    const incomingId = note?.id ?? null;
    if (didInitForOpenRef.current) {
      // Same note we're already tracking → parent just re-rendered after our
      // own save. Skip; the user's in-flight edits stay.
      if (incomingId === persistedIdRef.current) return;
      // Parent is still in "create" mode (note=null) but we've already
      // materialised the note locally after the first auto-save. Skip; we
      // own the state until close.
      if (incomingId === null && persistedIdRef.current !== null) return;
      // Otherwise the parent has switched us to a different note — fall
      // through and re-init.
    }
    didInitForOpenRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (note) {
      persistedIdRef.current = note.id;
      persistedBodyRef.current = note.body;
      latestBodyRef.current = note.body;
      setBody(note.body);
      setSavedAt(new Date(note.updatedAt));
      setSaveState("idle");
    } else {
      persistedIdRef.current = null;
      persistedBodyRef.current = "";
      latestBodyRef.current = "";
      setBody("");
      setSavedAt(null);
      setSaveState("idle");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, note]);

  const persistNow = React.useCallback(async () => {
    const current = latestBodyRef.current;
    const id = persistedIdRef.current;
    // No change since last persist? Nothing to do.
    if (current === persistedBodyRef.current) {
      if (isMountedRef.current) setSaveState("saved");
      return;
    }
    // Don't materialize an empty brand-new note.
    if (!current.trim() && id === null) {
      if (isMountedRef.current) setSaveState("idle");
      return;
    }
    if (isMountedRef.current) setSaveState("saving");
    try {
      const saved = id
        ? await updateNoteAction({ id, body: current })
        : await createNoteAction({ body: current, streamId: createStreamIdRef.current });

      persistedIdRef.current = saved.id;
      persistedBodyRef.current = saved.body;

      const next: NoteInput = {
        id: saved.id,
        streamId: saved.streamId ?? createStreamIdRef.current ?? "",
        title: null,
        body: saved.body,
        position: saved.position,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      };
      onSaved(next);

      if (isMountedRef.current) {
        setSavedAt(new Date(saved.updatedAt));
        setSaveState("saved");
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) setSaveState("error");
      toast.error("Failed to save note");
    }
  }, [onSaved]);

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistNow();
    }, SAVE_DEBOUNCE_MS);
  }

  function onBodyChange(value: string) {
    setBody(value);
    latestBodyRef.current = value;
    setSaveState("pending");
    scheduleSave();
  }

  // Flush any pending edits before allowing the sheet to close.
  function flushAndClose() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Fire and forget; the save completes in the background even if the
    // sheet has finished animating closed.
    if (latestBodyRef.current !== persistedBodyRef.current) {
      void persistNow();
    }
    onOpenChange(false);
  }

  function onSheetOpenChange(o: boolean) {
    if (!o) flushAndClose();
    else onOpenChange(o);
  }

  async function onDelete() {
    const id = persistedIdRef.current;
    if (!id) {
      // Brand new + empty: just close.
      onOpenChange(false);
      return;
    }
    if (!confirm("Delete this note?")) return;
    setDeleting(true);
    try {
      await deleteNoteAction({ id });
      onDeleted(id);
      toast.success("Note deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete note");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  const heading = noteTitle({ body });
  const headingDisplay = heading === "Untitled" && !body.trim() ? "New note" : heading;
  const side = isDesktop ? "right" : "bottom";

  return (
    <Sheet open={open} onOpenChange={onSheetOpenChange}>
      <SheetContent
        side={side}
        className={
          isDesktop
            ? "w-full sm:max-w-3xl rounded-l-2xl overflow-hidden flex flex-col gap-0 p-0"
            : "pb-8 flex flex-col gap-0 p-0"
        }
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="text-xl leading-tight break-words flex-1 min-w-0">
              {headingDisplay}
            </SheetTitle>
            <SaveIndicator state={saveState} savedAt={savedAt} />
          </div>
          <SheetDescription className="sr-only">
            Note editor. Changes auto-save shortly after you stop typing.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Start typing…"
            className="w-full h-full min-h-[60vh] resize-none bg-transparent outline-none border-0 px-6 py-5 text-base leading-relaxed placeholder:text-muted-foreground/60"
          />
        </div>

        <SheetFooter className="p-4 border-t bg-background">
          <Button variant="destructive" onClick={onDelete} disabled={deleting} className="mr-auto">
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
          <Button variant="outline" onClick={flushAndClose} disabled={deleting}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  let text = "";
  if (state === "saving") text = "Saving…";
  else if (state === "pending") text = "Unsaved";
  else if (state === "error") text = "Failed to save";
  else if (savedAt) text = `Saved ${formatDistanceToNow(savedAt, { addSuffix: true })}`;
  if (!text) return null;
  return (
    <span
      className={
        state === "error"
          ? "text-xs text-destructive shrink-0 pt-1"
          : "text-xs text-muted-foreground shrink-0 pt-1"
      }
    >
      {text}
    </span>
  );
}
