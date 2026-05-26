"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { deleteCardAction, updateCardAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/components/use-media-query";
import type { CardInput } from "./card-item";
import type { ColumnInput } from "./column";

interface Props {
  card: CardInput | null;
  columns: ColumnInput[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (card: CardInput) => void;
  onDeleted: (id: string) => void;
}

type Mode = "view" | "edit";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export function CardEditor({ card, columns, open, onOpenChange, onUpdated, onDeleted }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  // "Persisted" mirrors the card prop so Cancel can revert without re-fetching.
  const [persisted, setPersisted] = React.useState<CardInput | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("view");
  const [pending, setPending] = React.useState(false);

  // Sync local state when the editor opens on a new card.
  React.useEffect(() => {
    if (!open || !card) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPersisted(card);
    setTitle(card.title);
    setDescription(card.description ?? "");
    setDueDate(toDateInputValue(card.dueDate));
    setMode("view");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, card]);

  const columnName =
    persisted ? columns.find((c) => c.id === persisted.columnId)?.name ?? null : null;

  async function onSave() {
    if (!persisted) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setPending(true);
    try {
      const updated = await updateCardAction({
        id: persisted.id,
        title: title.trim(),
        description: description.trim() ? description : null,
        dueDate: dueDate || null,
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
      // Stay open; flip to view mode with the saved values.
      setPersisted(next);
      setTitle(next.title);
      setDescription(next.description ?? "");
      setDueDate(toDateInputValue(next.dueDate));
      setMode("view");
      toast.success("Saved");
    } catch (err) {
      toast.error("Failed to save card");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!persisted) return;
    if (!confirm("Delete this card?")) return;
    setPending(true);
    try {
      await deleteCardAction({ id: persisted.id });
      onDeleted(persisted.id);
      toast.success("Deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete card");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  function onCancelEdit() {
    if (!persisted) return;
    // Discard draft, restore from persisted, return to view.
    setTitle(persisted.title);
    setDescription(persisted.description ?? "");
    setDueDate(toDateInputValue(persisted.dueDate));
    setMode("view");
  }

  const viewBody = (
    <div className="space-y-4">
      <div className="prose-card text-sm whitespace-pre-wrap break-words">
        {persisted?.description && persisted.description.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{persisted.description}</ReactMarkdown>
        ) : (
          <span className="text-muted-foreground">No description.</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
        <span>
          In column: <span className="text-foreground">{columnName ?? "—"}</span>
        </span>
        {persisted?.dueDate ? (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Due {format(new Date(persisted.dueDate), "MMM d, yyyy")}
          </span>
        ) : (
          <span>No due date</span>
        )}
      </div>
    </div>
  );

  const editBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="card-title">Title</Label>
        <Input id="card-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="card-desc">Description (markdown)</Label>
        <AutoGrowTextarea
          id="card-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Markdown supported — # heading, **bold**, [link](url), - lists, etc."
          minRows={6}
          maxRows={20}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="card-due">Due date</Label>
        <Input
          id="card-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="text-xs text-muted-foreground">In column: {columnName ?? "—"}</div>
    </div>
  );

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
          <SheetTitle className="text-xl leading-tight break-words">
            {mode === "view" ? persisted?.title || "Card" : "Edit card"}
          </SheetTitle>
          <SheetDescription className={mode === "view" ? "sr-only" : undefined}>
            {mode === "view"
              ? "Viewing card details."
              : "Update card details, description, and due date."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {mode === "view" ? viewBody : editBody}
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
              <Button variant="destructive" onClick={onDelete} disabled={pending} className="mr-auto">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button variant="outline" onClick={onCancelEdit} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
