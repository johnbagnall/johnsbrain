"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/components/use-media-query";
import { noteTitle, type NoteInput } from "./note-card";

interface Props {
  /** The note being edited, or null when creating a new note. */
  note: NoteInput | null;
  /** Target stream for new notes (used only when `note` is null). */
  createStreamId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: NoteInput) => void;
  onDeleted: (id: string) => void;
}

type Mode = "view" | "edit";

export function NoteEditor({ note, createStreamId, open, onOpenChange, onSaved, onDeleted }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  // Persisted = what's saved; draft = what the user is typing.
  const [persistedTitle, setPersistedTitle] = React.useState<string | null>(null);
  const [persistedBody, setPersistedBody] = React.useState("");
  const [persistedId, setPersistedId] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [bodyDraft, setBodyDraft] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("edit");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (note) {
      setPersistedId(note.id);
      setPersistedTitle(note.title);
      setPersistedBody(note.body);
      setTitleDraft(note.title ?? "");
      setBodyDraft(note.body);
      setMode("view");
    } else {
      setPersistedId(null);
      setPersistedTitle(null);
      setPersistedBody("");
      setTitleDraft("");
      setBodyDraft("");
      setMode("edit");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, note]);

  const isCreate = persistedId === null;

  async function onSave() {
    const trimmedBody = bodyDraft.trim();
    if (!trimmedBody) {
      toast.error("Note can't be empty");
      return;
    }
    const trimmedTitle = titleDraft.trim();
    setPending(true);
    try {
      const saved = isCreate
        ? await createNoteAction({
            body: trimmedBody,
            title: trimmedTitle || null,
            streamId: createStreamId,
          })
        : await updateNoteAction({
            id: persistedId!,
            body: trimmedBody,
            title: trimmedTitle || null,
          });
      onSaved({
        id: saved.id,
        streamId: saved.streamId ?? createStreamId ?? "",
        title: saved.title,
        body: saved.body,
        position: saved.position,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      });
      setPersistedId(saved.id);
      setPersistedTitle(saved.title);
      setPersistedBody(saved.body);
      setTitleDraft(saved.title ?? "");
      setBodyDraft(saved.body);
      setMode("view");
      toast.success(isCreate ? "Note added" : "Note saved");
    } catch (err) {
      toast.error(isCreate ? "Failed to add note" : "Failed to save note");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (isCreate || !persistedId) return;
    if (!confirm("Delete this note?")) return;
    setPending(true);
    try {
      await deleteNoteAction({ id: persistedId });
      onDeleted(persistedId);
      toast.success("Note deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete note");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
  }

  function onCancelEdit() {
    if (isCreate) {
      onOpenChange(false);
      return;
    }
    setTitleDraft(persistedTitle ?? "");
    setBodyDraft(persistedBody);
    setMode("view");
  }

  const headerTitle = isCreate
    ? "Add note"
    : noteTitle({ title: persistedTitle, body: persistedBody });

  const side = isDesktop ? "right" : "bottom";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={
          isDesktop
            ? "w-full sm:max-w-3xl rounded-l-2xl overflow-hidden flex flex-col gap-0 p-0"
            : "pb-8 flex flex-col gap-0 p-0"
        }
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-xl leading-tight break-words">{headerTitle}</SheetTitle>
          <SheetDescription className={mode === "view" ? "sr-only" : undefined}>
            {mode === "view"
              ? "Viewing note details."
              : "Markdown supported in the body. ⌘/Ctrl + Enter to save."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {mode === "view" ? (
            <div className="prose-card text-sm whitespace-pre-wrap break-words">
              {persistedBody.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{persistedBody}</ReactMarkdown>
              ) : (
                <span className="text-muted-foreground">This note is empty.</span>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="note-title">Title (optional)</Label>
                <Input
                  id="note-title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Leave blank to use the first words of the body"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-body">Body (markdown)</Label>
                <AutoGrowTextarea
                  id="note-body"
                  autoFocus
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Capture a thought…"
                  minRows={10}
                  maxRows={24}
                  className="min-h-[200px]"
                />
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="p-4 border-t bg-background">
          {mode === "view" ? (
            <div className="flex gap-2 w-full">
              <Button variant="destructive" onClick={onDelete} disabled={pending} className="mr-auto">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button onClick={() => setMode("edit")} disabled={pending}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              {!isCreate ? (
                <Button variant="destructive" onClick={onDelete} disabled={pending} className="mr-auto">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={onCancelEdit}
                disabled={pending}
                className={isCreate ? "mr-auto" : ""}
              >
                Cancel
              </Button>
              <Button onClick={onSave} disabled={pending || !bodyDraft.trim()}>
                {pending ? "Saving…" : isCreate ? "Add note" : "Save"}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
