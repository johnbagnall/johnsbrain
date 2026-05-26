"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

export interface CardInput {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
}

export function CardItem({
  card,
  onOpen,
  dragging = false,
}: {
  card: CardInput;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", columnId: card.columnId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const isOverdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-card rounded-lg border shadow-sm hover:shadow transition-shadow",
        dragging && "shadow-lg rotate-1",
      )}
    >
      <div className="flex items-start gap-1 p-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag card"
          className="touch-none shrink-0 mt-0.5 h-7 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          className="flex-1 text-left min-w-0 py-1 pr-1"
          onClick={onOpen}
          aria-label={`Open card ${card.title}`}
        >
          <div className="text-sm font-medium leading-snug line-clamp-3">{card.title}</div>
          {dueDate ? (
            <div
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-xs",
                isOverdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" />
              {format(dueDate, "MMM d")}
            </div>
          ) : null}
        </button>
      </div>
    </div>
  );
}
