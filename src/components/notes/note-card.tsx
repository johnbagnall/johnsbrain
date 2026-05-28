"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface NoteInput {
  id: string;
  streamId: string;
  /** Legacy. New notes don't use this; the first line of `body` is the title. */
  title: string | null;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

const MAX_TITLE_LEN = 80;

/**
 * Display title for a note. First non-empty line of the body, truncated.
 * Falls back to "Untitled" only if the body is completely empty.
 */
export function noteTitle(n: { body: string }): string {
  const line = n.body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "Untitled";
  return line.length > MAX_TITLE_LEN ? line.slice(0, MAX_TITLE_LEN).trimEnd() + "…" : line;
}

/** Everything after the first non-empty line, joined and trimmed. */
export function noteExcerpt(body: string): string {
  const lines = body.split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmpty < 0) return "";
  return lines.slice(firstNonEmpty + 1).join("\n").trim();
}

export function NoteCard({
  note,
  onOpen,
  dragging = false,
}: {
  note: NoteInput;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    data: { type: "note", streamId: note.streamId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const createdAt = new Date(note.createdAt);
  const updatedAt = new Date(note.updatedAt);
  const wasEdited = updatedAt.getTime() - createdAt.getTime() > 1000;
  const heading = noteTitle(note);
  const excerpt = noteExcerpt(note.body);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/note relative flex flex-col rounded-lg border bg-card hover:border-foreground/20 hover:shadow-sm transition-all",
        dragging && "shadow-lg rotate-2",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag note"
        className="absolute right-1.5 top-1.5 touch-none h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/note:opacity-100 focus-visible:opacity-100 hover:bg-accent cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        onClick={onOpen}
        aria-label="Open note"
        className="flex h-full w-full flex-col text-left p-3 sm:p-4"
      >
        <div className="text-sm font-medium leading-snug line-clamp-2 pr-7">{heading}</div>
        {excerpt ? (
          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-4">
            {excerpt}
          </div>
        ) : null}
        <div
          className="text-xs text-muted-foreground mt-2"
          title={format(createdAt, "PPpp")}
        >
          {formatDistanceToNow(createdAt, { addSuffix: true })}
          {wasEdited ? " · edited" : null}
        </div>
      </button>
    </div>
  );
}
