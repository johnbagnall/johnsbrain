"use client";
import * as React from "react";
import { LayoutGrid, StickyNote } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Board } from "@/components/board/board";
import { Notes, type NoteInput, type StreamInput } from "@/components/notes/notes";
import type { ColumnInput } from "@/components/board/column";
import type { CardInput } from "@/components/board/card-item";

interface Props {
  columns: ColumnInput[];
  cards: CardInput[];
  streams: StreamInput[];
  notes: NoteInput[];
}

export function BoardTabs({ columns, cards, streams, notes }: Props) {
  return (
    <Tabs defaultValue="board" className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-center sm:justify-start px-4 pt-3 pb-1">
        <TabsList>
          <TabsTrigger value="board">
            <LayoutGrid className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4" />
            Notes
            {notes.length > 0 ? (
              <span className="ml-0.5 rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">
                {notes.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* forceMount keeps both panes alive so switching tabs preserves
          drag state, scroll position, and unsaved note drafts. */}
      <TabsContent
        value="board"
        forceMount
        className="flex-1 min-h-0 flex flex-col data-[state=inactive]:hidden"
      >
        <Board initialColumns={columns} initialCards={cards} />
      </TabsContent>

      <TabsContent
        value="notes"
        forceMount
        className="flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden"
      >
        <Notes initialStreams={streams} initialNotes={notes} />
      </TabsContent>
    </Tabs>
  );
}
