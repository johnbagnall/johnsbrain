"use client";
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCardAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardItem, type CardInput } from "./card-item";

export interface ColumnInput {
  id: string;
  name: string;
  position: number;
}

interface Props {
  column: ColumnInput;
  cards: CardInput[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenCard: (id: string) => void;
  onCardCreated: (card: CardInput) => void;
}

export function ColumnView({ column, cards, onRename, onDelete, onOpenCard, onCardCreated }: Props) {
  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(column.name);
  const [addingCard, setAddingCard] = React.useState(false);
  const [newCardTitle, setNewCardTitle] = React.useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setName(column.name), [column.name]);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });

  async function onAddCard(e: React.FormEvent) {
    e.preventDefault();
    const title = newCardTitle.trim();
    if (!title) return;
    try {
      const card = await createCardAction({ title, columnId: column.id });
      onCardCreated({
        id: card.id,
        columnId: card.columnId,
        title: card.title,
        description: card.description,
        dueDate: card.dueDate ? new Date(card.dueDate).toISOString() : null,
        position: card.position,
      });
      setNewCardTitle("");
      setAddingCard(false);
    } catch (err) {
      toast.error("Failed to add card");
      console.error(err);
    }
  }

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(column.name);
      setEditingName(false);
      return;
    }
    if (trimmed !== column.name) onRename(trimmed);
    setEditingName(false);
  }

  return (
    <div
      ref={setNodeRef}
      data-testid="kanban-column"
      data-column-name={column.name}
      className={
        "snap-start shrink-0 w-[85vw] max-w-[340px] sm:w-80 bg-muted/40 rounded-xl border flex flex-col max-h-full " +
        (isOver ? "ring-2 ring-ring" : "")
      }
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setName(column.name);
                setEditingName(false);
              }
            }}
            className="h-8 text-sm font-medium"
          />
        ) : (
          <button
            className="font-medium text-sm flex-1 text-left truncate hover:underline"
            onClick={() => setEditingName(true)}
            aria-label="Rename column"
          >
            {column.name}
          </button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Column actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6 select-none">No cards yet</div>
          ) : (
            cards.map((card) => <CardItem key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />)
          )}
        </SortableContext>
      </div>
      <div className="p-2 border-t border-border/50">
        {addingCard ? (
          <form onSubmit={onAddCard} className="space-y-2">
            <Input
              autoFocus
              placeholder="Card title"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingCard(false);
                  setNewCardTitle("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-start h-9" onClick={() => setAddingCard(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add card
          </Button>
        )}
      </div>
    </div>
  );
}
