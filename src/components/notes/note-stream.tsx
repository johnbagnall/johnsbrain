"use client";
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NoteCard, type NoteInput } from "./note-card";

export interface StreamInput {
  id: string;
  name: string;
  position: number;
}

interface Props {
  stream: StreamInput;
  notes: NoteInput[];
  /** False when this is the user's only stream — deletion is then blocked. */
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddNote: () => void;
  onOpenNote: (id: string) => void;
}

export function StreamBand({
  stream,
  notes,
  canDelete,
  onRename,
  onDelete,
  onAddNote,
  onOpenNote,
}: Props) {
  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(stream.name);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setName(stream.name), [stream.name]);

  const { setNodeRef, isOver } = useDroppable({ id: stream.id, data: { type: "stream" } });

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(stream.name);
      setEditingName(false);
      return;
    }
    if (trimmed !== stream.name) onRename(trimmed);
    setEditingName(false);
  }

  return (
    <section
      ref={setNodeRef}
      data-testid="note-stream"
      data-stream-name={stream.name}
      className={cn(
        "rounded-xl border bg-muted/30 p-3 sm:p-4 transition-shadow",
        isOver && "ring-2 ring-ring",
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setName(stream.name);
                setEditingName(false);
              }
            }}
            className="h-8 max-w-xs font-semibold"
          />
        ) : (
          <button
            className="font-semibold text-left truncate hover:underline"
            onClick={() => setEditingName(true)}
            aria-label="Rename stream"
          >
            {stream.name}
          </button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{notes.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onAddNote}>
            <Plus className="h-4 w-4 mr-1" /> Add note
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Stream actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                disabled={!canDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {canDelete ? "Delete stream" : "Can't delete last stream"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SortableContext items={notes.map((n) => n.id)} strategy={rectSortingStrategy}>
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed text-sm text-muted-foreground text-center py-8 select-none">
            Drop notes here, or hit Add note.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onOpen={() => onOpenNote(note.id)} />
            ))}
          </div>
        )}
      </SortableContext>
    </section>
  );
}
