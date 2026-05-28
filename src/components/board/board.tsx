"use client";
import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  createColumnAction,
  deleteColumnAction,
  moveCardAction,
  renameColumnAction,
  reorderColumnsAction,
} from "@/lib/actions";
import { ColumnView, type ColumnInput } from "./column";
import { CardItem, type CardInput } from "./card-item";
import { CardEditor } from "./card-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface BoardProps {
  initialColumns: ColumnInput[];
  initialCards: CardInput[];
}

export function Board({ initialColumns, initialCards }: BoardProps) {
  const [columns, setColumns] = React.useState<ColumnInput[]>(initialColumns);
  const [cards, setCards] = React.useState<CardInput[]>(initialCards);
  const [addingColumn, setAddingColumn] = React.useState(false);
  const [newColumnName, setNewColumnName] = React.useState("");
  const [activeCardId, setActiveCardId] = React.useState<string | null>(null);
  const [editingCardId, setEditingCardId] = React.useState<string | null>(null);

  // Keep state in sync when the server returns fresh data (e.g. after revalidatePath).
  // The setState-in-effect pattern is intentional: a key-based remount would discard
  // optimistic drag state in flight.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setColumns(initialColumns), [initialColumns]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setCards(initialCards), [initialCards]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function cardsInColumn(columnId: string) {
    return cards
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  function findCard(id: string) {
    return cards.find((c) => c.id === id);
  }

  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "card") {
      setActiveCardId(String(e.active.id));
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    if (active.data.current?.type !== "card") return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeCard = findCard(activeId);
    if (!activeCard) return;

    // The drop target is either a card or a column droppable.
    const overIsColumn = over.data.current?.type === "column";
    const overCard = overIsColumn ? null : findCard(overId);
    const targetColumnId = overIsColumn ? overId : overCard?.columnId;
    if (!targetColumnId) return;
    if (activeCard.columnId === targetColumnId) return;

    // Optimistically move the card to the new column at the end (drag-end will refine).
    setCards((prev) => {
      const without = prev.filter((c) => c.id !== activeId);
      const destCards = without.filter((c) => c.columnId === targetColumnId);
      const newCard = { ...activeCard, columnId: targetColumnId, position: destCards.length };
      // Re-pack positions in source and dest.
      const updated = without.map((c) => {
        if (c.columnId === activeCard.columnId && c.position > activeCard.position) {
          return { ...c, position: c.position - 1 };
        }
        return c;
      });
      return [...updated, newCard];
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = e;
    if (!over) return;

    if (active.data.current?.type === "column" && over.data.current?.type === "column") {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));
      setColumns(reordered);
      try {
        await reorderColumnsAction({ orderedIds: reordered.map((c) => c.id) });
      } catch (err) {
        toast.error("Failed to reorder columns");
        setColumns(columns);
        console.error(err);
      }
      return;
    }

    if (active.data.current?.type === "card") {
      const activeId = String(active.id);
      const activeCard = findCard(activeId);
      if (!activeCard) return;

      const overId = String(over.id);
      const overIsColumn = over.data.current?.type === "column";
      const overCard = overIsColumn ? null : findCard(overId);

      const targetColumnId = overIsColumn ? overId : overCard?.columnId;
      if (!targetColumnId) return;

      const destCards = cardsInColumn(targetColumnId).filter((c) => c.id !== activeId);
      let targetPos: number;
      if (overIsColumn || !overCard) {
        targetPos = destCards.length;
      } else {
        targetPos = destCards.findIndex((c) => c.id === overCard.id);
        if (targetPos < 0) targetPos = destCards.length;
      }

      // Optimistic local update: re-pack positions in both columns.
      setCards((prev) => {
        const moved = prev.map((c) => ({ ...c }));
        const card = moved.find((c) => c.id === activeId)!;
        // Remove from source first (positions in source compact).
        const sourceColumnId = card.columnId;
        const sourceOldPos = card.position;
        for (const c of moved) {
          if (c.id === activeId) continue;
          if (c.columnId === sourceColumnId && c.position > sourceOldPos) c.position -= 1;
        }
        // Open slot in dest.
        for (const c of moved) {
          if (c.id === activeId) continue;
          if (c.columnId === targetColumnId && c.position >= targetPos) c.position += 1;
        }
        card.columnId = targetColumnId;
        card.position = targetPos;
        return moved;
      });

      try {
        await moveCardAction({ id: activeId, columnId: targetColumnId, position: targetPos });
      } catch (err) {
        toast.error("Failed to move card");
        // Refresh from server on failure.
        setCards(initialCards);
        setColumns(initialColumns);
        console.error(err);
      }
    }
  }

  async function onAddColumn(e: React.FormEvent) {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;
    try {
      const col = await createColumnAction({ name });
      setColumns((prev) => [...prev, { id: col.id, name: col.name, position: col.position }]);
      setNewColumnName("");
      setAddingColumn(false);
    } catch (err) {
      toast.error("Failed to add column");
      console.error(err);
    }
  }

  async function onRenameColumn(id: string, name: string) {
    const prev = columns;
    setColumns((p) => p.map((c) => (c.id === id ? { ...c, name } : c)));
    try {
      await renameColumnAction({ id, name });
    } catch (err) {
      toast.error("Failed to rename column");
      setColumns(prev);
      console.error(err);
    }
  }

  async function onDeleteColumn(id: string) {
    if (!confirm("Delete this column and all its cards?")) return;
    const prevCols = columns;
    const prevCards = cards;
    setColumns((p) => p.filter((c) => c.id !== id));
    setCards((p) => p.filter((c) => c.columnId !== id));
    try {
      await deleteColumnAction({ id });
    } catch (err) {
      toast.error("Failed to delete column");
      setColumns(prevCols);
      setCards(prevCards);
      console.error(err);
    }
  }

  function onCardCreated(card: CardInput) {
    setCards((prev) => [...prev, card]);
  }
  function onCardUpdated(card: CardInput) {
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
  }
  function onCardDeleted(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  const isEmpty = columns.length === 0;
  const activeCard = activeCardId ? findCard(activeCardId) ?? null : null;
  const editingCard = editingCardId ? findCard(editingCardId) ?? null : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <DndContext
        id="kanban-board"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory sm:snap-none">
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex gap-4 p-4 h-full items-stretch min-w-max">
              {columns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  cards={cardsInColumn(col.id)}
                  onRename={(name) => onRenameColumn(col.id, name)}
                  onDelete={() => onDeleteColumn(col.id)}
                  onOpenCard={(cardId) => setEditingCardId(cardId)}
                  onCardCreated={onCardCreated}
                />
              ))}
              <div className="snap-start shrink-0 w-[85vw] max-w-[320px] sm:w-72">
                {addingColumn ? (
                  <form onSubmit={onAddColumn} className="bg-card rounded-xl border p-3 space-y-2">
                    <Input
                      autoFocus
                      placeholder="Column name"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
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
                          setAddingColumn(false);
                          setNewColumnName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button variant="ghost" className="w-full justify-start h-12" onClick={() => setAddingColumn(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add column
                  </Button>
                )}
              </div>
            </div>
          </SortableContext>
        </div>
        <DragOverlay>
          {activeCard ? <CardItem card={activeCard} dragging onOpen={() => {}} /> : null}
        </DragOverlay>
      </DndContext>
      {isEmpty ? (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-muted-foreground">
          Your board is empty. Add a column to get started.
        </div>
      ) : null}
      <CardEditor
        card={editingCard}
        open={!!editingCard}
        onOpenChange={(open) => !open && setEditingCardId(null)}
        onUpdated={onCardUpdated}
        onDeleted={onCardDeleted}
      />
    </div>
  );
}
