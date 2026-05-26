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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createNoteStreamAction, deleteNoteStreamAction, moveNoteAction, renameNoteStreamAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamBand, type StreamInput } from "./note-stream";
import { NoteCard, type NoteInput } from "./note-card";
import { NoteEditor } from "./note-editor";

export type { NoteInput } from "./note-card";
export type { StreamInput } from "./note-stream";

type EditorState =
  | { mode: "create"; streamId: string }
  | { mode: "edit"; id: string }
  | null;

interface Props {
  initialStreams: StreamInput[];
  initialNotes: NoteInput[];
}

export function Notes({ initialStreams, initialNotes }: Props) {
  const [streams, setStreams] = React.useState<StreamInput[]>(initialStreams);
  const [notes, setNotes] = React.useState<NoteInput[]>(initialNotes);
  const [editor, setEditor] = React.useState<EditorState>(null);
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null);
  const [addingStream, setAddingStream] = React.useState(false);
  const [newStreamName, setNewStreamName] = React.useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setStreams(initialStreams), [initialStreams]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setNotes(initialNotes), [initialNotes]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function notesInStream(streamId: string) {
    return notes.filter((n) => n.streamId === streamId).sort((a, b) => a.position - b.position);
  }
  function findNote(id: string) {
    return notes.find((n) => n.id === id);
  }

  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "note") setActiveNoteId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type !== "note") return;
    const activeId = String(active.id);
    const activeNote = findNote(activeId);
    if (!activeNote) return;

    const overIsStream = over.data.current?.type === "stream";
    const overNote = overIsStream ? null : findNote(String(over.id));
    const targetStreamId = overIsStream ? String(over.id) : overNote?.streamId;
    if (!targetStreamId || activeNote.streamId === targetStreamId) return;

    // Optimistically drop into the new stream at the end; drag-end refines.
    setNotes((prev) => {
      const without = prev.filter((n) => n.id !== activeId);
      const destCount = without.filter((n) => n.streamId === targetStreamId).length;
      const repacked = without.map((n) =>
        n.streamId === activeNote.streamId && n.position > activeNote.position
          ? { ...n, position: n.position - 1 }
          : n,
      );
      return [...repacked, { ...activeNote, streamId: targetStreamId, position: destCount }];
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveNoteId(null);
    const { active, over } = e;
    if (!over || active.data.current?.type !== "note") return;

    const activeId = String(active.id);
    const activeNote = findNote(activeId);
    if (!activeNote) return;

    const overIsStream = over.data.current?.type === "stream";
    const overNote = overIsStream ? null : findNote(String(over.id));
    const targetStreamId = overIsStream ? String(over.id) : overNote?.streamId;
    if (!targetStreamId) return;

    const destNotes = notesInStream(targetStreamId).filter((n) => n.id !== activeId);
    let targetPos: number;
    if (overIsStream || !overNote) {
      targetPos = destNotes.length;
    } else {
      targetPos = destNotes.findIndex((n) => n.id === overNote.id);
      if (targetPos < 0) targetPos = destNotes.length;
    }

    setNotes((prev) => {
      const moved = prev.map((n) => ({ ...n }));
      const n = moved.find((x) => x.id === activeId)!;
      const srcStream = n.streamId;
      const srcOld = n.position;
      for (const x of moved) {
        if (x.id === activeId) continue;
        if (x.streamId === srcStream && x.position > srcOld) x.position -= 1;
      }
      for (const x of moved) {
        if (x.id === activeId) continue;
        if (x.streamId === targetStreamId && x.position >= targetPos) x.position += 1;
      }
      n.streamId = targetStreamId;
      n.position = targetPos;
      return moved;
    });

    try {
      await moveNoteAction({ id: activeId, streamId: targetStreamId, position: targetPos });
    } catch (err) {
      toast.error("Failed to move note");
      setNotes(initialNotes);
      setStreams(initialStreams);
      console.error(err);
    }
  }

  async function onAddStream(e: React.FormEvent) {
    e.preventDefault();
    const name = newStreamName.trim();
    if (!name) return;
    try {
      const stream = await createNoteStreamAction({ name });
      setStreams((prev) => [...prev, { id: stream.id, name: stream.name, position: stream.position }]);
      setNewStreamName("");
      setAddingStream(false);
    } catch (err) {
      toast.error("Failed to add stream");
      console.error(err);
    }
  }

  async function onRenameStream(id: string, name: string) {
    const prev = streams;
    setStreams((s) => s.map((x) => (x.id === id ? { ...x, name } : x)));
    try {
      await renameNoteStreamAction({ id, name });
    } catch (err) {
      toast.error("Failed to rename stream");
      setStreams(prev);
      console.error(err);
    }
  }

  async function onDeleteStream(id: string) {
    if (streams.length <= 1) return;
    if (!confirm("Delete this stream? Its notes move to another stream.")) return;
    const prevStreams = streams;
    const prevNotes = notes;
    const fallback = streams.find((s) => s.id !== id)!;
    setStreams((s) => s.filter((x) => x.id !== id));
    setNotes((ns) => ns.map((n) => (n.streamId === id ? { ...n, streamId: fallback.id } : n)));
    try {
      await deleteNoteStreamAction({ id });
    } catch (err) {
      toast.error("Failed to delete stream");
      setStreams(prevStreams);
      setNotes(prevNotes);
      console.error(err);
    }
  }

  function onSaved(saved: NoteInput) {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [...prev, saved];
    });
  }
  function onDeleted(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const sortedStreams = [...streams].sort((a, b) => a.position - b.position);
  const activeNote = activeNoteId ? findNote(activeNoteId) ?? null : null;
  const editingNote =
    editor?.mode === "edit" ? notes.find((n) => n.id === editor.id) ?? null : null;
  const createStreamId = editor?.mode === "create" ? editor.streamId : sortedStreams[0]?.id;

  return (
    <section>
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-4">
        <DndContext
          id="notes-streams"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="space-y-4">
            {sortedStreams.map((stream) => (
              <StreamBand
                key={stream.id}
                stream={stream}
                notes={notesInStream(stream.id)}
                canDelete={streams.length > 1}
                onRename={(name) => onRenameStream(stream.id, name)}
                onDelete={() => onDeleteStream(stream.id)}
                onAddNote={() => setEditor({ mode: "create", streamId: stream.id })}
                onOpenNote={(id) => setEditor({ mode: "edit", id })}
              />
            ))}
          </div>
          <DragOverlay>
            {activeNote ? <NoteCard note={activeNote} dragging onOpen={() => {}} /> : null}
          </DragOverlay>
        </DndContext>

        {addingStream ? (
          <form onSubmit={onAddStream} className="flex gap-2 max-w-md">
            <Input
              autoFocus
              placeholder="Stream name (e.g. Project X)"
              value={newStreamName}
              onChange={(e) => setNewStreamName(e.target.value)}
            />
            <Button type="submit">Add</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAddingStream(false);
                setNewStreamName("");
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setAddingStream(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add work stream
          </Button>
        )}
      </div>

      <NoteEditor
        note={editingNote}
        createStreamId={createStreamId}
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </section>
  );
}
