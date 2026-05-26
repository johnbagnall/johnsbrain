"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface NoteInput {
  id: string;
  streamId: string;
  title: string | null;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The display title for a note. Uses the explicit `title` when set, otherwise
 * falls back to the first four words of the body. Returns "Untitled" only when
 * both are empty.
 */
export function noteTitle(n: Pick<NoteInput, "title" | "body">): string {
  const explicit = (n.title ?? "").trim();
  if (explicit) return explicit;
  const words = n.body.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.join(" ") : "Untitled";
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
  const hasExplicitTitle = !!note.title?.trim();

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
        aria-label={`Open note ${heading}`}
        className="flex h-full w-full flex-col text-left p-3 sm:p-4"
      >
        <div className="text-sm font-medium leading-snug line-clamp-3 pr-7">{heading}</div>
        {/* Show a body excerpt only when the title is explicit; otherwise the
            heading already shows the first words of the body and the excerpt
            would just repeat them. */}
        {hasExplicitTitle && note.body.trim() ? (
          <div className="prose-card text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
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
