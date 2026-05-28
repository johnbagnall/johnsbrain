"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { deleteCardAction, updateCardAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/components/use-media-query";
import type { CardInput } from "./card-item";

interface Props {
  card: CardInput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (card: CardInput) => void;
  onDeleted: (id: string) => void;
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 800;
const MAX_TITLE_LEN = 80;

/** title + (optional description) joined into a single canvas body. */
function cardToBody(card: CardInput): string {
  const title = card.title || "";
  const desc = (card.description ?? "").trim();
  return desc ? `${title}\n\n${desc}` : title;
}

/** First non-empty line of the body becomes the title; the rest is description. */
function splitBody(body: string): { title: string; description: string | null } {
  const lines = body.split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmpty < 0) return { title: "", description: null };
  const title = lines[firstNonEmpty].trim();
  const rest = lines.slice(firstNonEmpty + 1).join("\n").trim();
  return { title, description: rest || null };
}

function deriveHeaderTitle(body: string): string {
  const { title } = splitBody(body);
  if (!title) return "Card";
  return title.length > MAX_TITLE_LEN ? title.slice(0, MAX_TITLE_LEN).trimEnd() + "…" : title;
}

export function CardEditor({ card, open, onOpenChange, onUpdated, onDeleted }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const [body, setBody] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const persistedIdRef = React.useRef<string | null>(null);
  const persistedBodyRef = React.useRef("");
  const latestBodyRef = React.useRef("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = React.useRef(true);
  const didInitForOpenRef = React.useRef(false);

  React.useEffect(
    () => () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Tick once a minute so "Saved 2m ago" stays fresh.
  const [, forceRerender] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceRerender((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [open]);

  // Sync from `card` only on open or when truly switching cards. Same anti-
  // clobber gate as the notes editor.
  React.useEffect(() => {
    if (!open) {
      didInitForOpenRef.current = false;
      persistedIdRef.current = null;
      persistedBodyRef.current = "";
      latestBodyRef.current = "";
      return;
    }
    const incomingId = card?.id ?? null;
    if (didInitForOpenRef.current) {
      if (incomingId === persistedIdRef.current) return;
    }
    didInitForOpenRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (card) {
      const b = cardToBody(card);
      persistedIdRef.current = card.id;
      persistedBodyRef.current = b;
      latestBodyRef.current = b;
      setBody(b);
      setSavedAt(new Date());
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
  }, [open, card]);

  const persistNow = React.useCallback(async () => {
    const id = persistedIdRef.current;
    if (!id) return;
    const current = latestBodyRef.current;
    if (current === persistedBodyRef.current) {
      if (isMountedRef.current) setSaveState("saved");
      return;
    }
    const { title, description } = splitBody(current);
    if (!title) {
      // Can't save a card with an empty title — keep as pending until the
      // user types something. (Use Delete to remove the card.)
      if (isMountedRef.current) setSaveState("pending");
      return;
    }
    if (isMountedRef.current) setSaveState("saving");
    try {
      const updated = await updateCardAction({ id, title, description });
      persistedBodyRef.current = cardToBody({
        id: updated.id,
        columnId: updated.columnId,
        title: updated.title,
        description: updated.description,
        dueDate: updated.dueDate ? new Date(updated.dueDate).toISOString() : null,
        position: updated.position,
      });
      const next: CardInput = {
        id: updated.id,
        columnId: updated.columnId,
        title: updated.title,
        description: updated.description,
        dueDate: updated.dueDate ? new Date(updated.dueDate).toISOString() : null,
        position: updated.position,
      };
      onUpdated(next);
      if (isMountedRef.current) {
        setSavedAt(new Date(updated.updatedAt));
        setSaveState("saved");
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) setSaveState("error");
      toast.error("Failed to save card");
    }
  }, [onUpdated]);

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistNow(), SAVE_DEBOUNCE_MS);
  }

  function onBodyChange(value: string) {
    setBody(value);
    latestBodyRef.current = value;
    setSaveState("pending");
    scheduleSave();
  }

  function flushAndClose() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
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
      onOpenChange(false);
      return;
    }
    if (!confirm("Delete this card?")) return;
    setDeleting(true);
    try {
      await deleteCardAction({ id });
      onDeleted(id);
      toast.success("Deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete card");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  const headerTitle = deriveHeaderTitle(body);
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
              {headerTitle}
            </SheetTitle>
            <SaveIndicator state={saveState} savedAt={savedAt} />
          </div>
          <SheetDescription className="sr-only">
            Card editor. Changes auto-save shortly after you stop typing.
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
