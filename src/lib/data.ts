import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "./db";

/** Internal: load the user's single board, lazily seeding if missing. */
async function getOrCreateBoard(userId: string) {
  const [existing] = db
    .select()
    .from(schema.board)
    .where(eq(schema.board.userId, userId))
    .limit(1)
    .all();
  if (existing) return existing;

  // Defensive seed — Better Auth's create-after hook should have run already.
  const now = new Date();
  const boardId = nanoid();
  db.insert(schema.board)
    .values({ id: boardId, userId, name: "My Board", createdAt: now })
    .run();
  const defaults = ["To Do", "In Progress", "Done"];
  for (let i = 0; i < defaults.length; i++) {
    db.insert(schema.column)
      .values({ id: nanoid(), boardId, name: defaults[i], position: i, createdAt: now })
      .run();
  }
  return db.select().from(schema.board).where(eq(schema.board.id, boardId)).get()!;
}

export async function getBoardForUser(userId: string) {
  const board = await getOrCreateBoard(userId);
  const columns = db
    .select()
    .from(schema.column)
    .where(eq(schema.column.boardId, board.id))
    .orderBy(asc(schema.column.position))
    .all();
  const columnIds = columns.map((c) => c.id);
  const cards =
    columnIds.length === 0
      ? []
      : db
          .select()
          .from(schema.card)
          .where(inArray(schema.card.columnId, columnIds))
          .orderBy(asc(schema.card.position))
          .all();
  return { board, columns, cards };
}

/** Confirm a column belongs to the user; throws if not. */
function assertOwnColumn(userId: string, columnId: string) {
  const row = db
    .select({ columnId: schema.column.id })
    .from(schema.column)
    .innerJoin(schema.board, eq(schema.board.id, schema.column.boardId))
    .where(and(eq(schema.column.id, columnId), eq(schema.board.userId, userId)))
    .limit(1)
    .get();
  if (!row) throw new Error("Column not found");
}

function loadCardForUser(userId: string, cardId: string) {
  const row = db
    .select({
      card: schema.card,
      boardUserId: schema.board.userId,
    })
    .from(schema.card)
    .innerJoin(schema.column, eq(schema.column.id, schema.card.columnId))
    .innerJoin(schema.board, eq(schema.board.id, schema.column.boardId))
    .where(eq(schema.card.id, cardId))
    .limit(1)
    .get();
  if (!row || row.boardUserId !== userId) throw new Error("Card not found");
  return row.card;
}

// ---------- Columns ----------
export async function createColumn(userId: string, name: string) {
  const board = await getOrCreateBoard(userId);
  const [{ maxPos } = { maxPos: -1 }] = db
    .select({ maxPos: sql<number>`COALESCE(MAX(${schema.column.position}), -1)` })
    .from(schema.column)
    .where(eq(schema.column.boardId, board.id))
    .all();
  const id = nanoid();
  db.insert(schema.column)
    .values({ id, boardId: board.id, name, position: maxPos + 1, createdAt: new Date() })
    .run();
  return db.select().from(schema.column).where(eq(schema.column.id, id)).get()!;
}

export async function renameColumn(userId: string, columnId: string, name: string) {
  assertOwnColumn(userId, columnId);
  db.update(schema.column).set({ name }).where(eq(schema.column.id, columnId)).run();
}

export async function deleteColumn(userId: string, columnId: string) {
  assertOwnColumn(userId, columnId);
  db.delete(schema.column).where(eq(schema.column.id, columnId)).run();
}

export async function reorderColumns(userId: string, orderedIds: string[]) {
  const board = await getOrCreateBoard(userId);
  // Validate every id belongs to the board.
  const owned = db
    .select({ id: schema.column.id })
    .from(schema.column)
    .where(eq(schema.column.boardId, board.id))
    .all()
    .map((r) => r.id);
  const ownedSet = new Set(owned);
  for (const id of orderedIds) {
    if (!ownedSet.has(id)) throw new Error("Unknown column in reorder payload");
  }
  db.transaction((tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      tx.update(schema.column).set({ position: i }).where(eq(schema.column.id, orderedIds[i])).run();
    }
  });
}

// ---------- Cards ----------
export async function listCards(
  userId: string,
  filters?: { columnId?: string; dueBefore?: Date; dueAfter?: Date },
) {
  const board = await getOrCreateBoard(userId);
  // Restrict to columns of this user's board.
  const userColumnIds = db
    .select({ id: schema.column.id })
    .from(schema.column)
    .where(eq(schema.column.boardId, board.id))
    .all()
    .map((r) => r.id);
  if (userColumnIds.length === 0) return [];

  const conditions = [inArray(schema.card.columnId, userColumnIds)];
  if (filters?.columnId) {
    if (!userColumnIds.includes(filters.columnId)) return [];
    conditions.push(eq(schema.card.columnId, filters.columnId));
  }
  if (filters?.dueBefore) conditions.push(lte(schema.card.dueDate, filters.dueBefore));
  if (filters?.dueAfter) conditions.push(gte(schema.card.dueDate, filters.dueAfter));

  return db
    .select()
    .from(schema.card)
    .where(and(...conditions))
    .orderBy(asc(schema.card.position))
    .all();
}

export async function createCard(
  userId: string,
  input: { title: string; description?: string | null; columnId?: string; dueDate?: Date | null },
) {
  const board = await getOrCreateBoard(userId);
  let columnId = input.columnId;
  if (columnId) {
    assertOwnColumn(userId, columnId);
  } else {
    const leftmost = db
      .select()
      .from(schema.column)
      .where(eq(schema.column.boardId, board.id))
      .orderBy(asc(schema.column.position))
      .limit(1)
      .get();
    if (!leftmost) throw new Error("No columns on board");
    columnId = leftmost.id;
  }
  const [{ maxPos } = { maxPos: -1 }] = db
    .select({ maxPos: sql<number>`COALESCE(MAX(${schema.card.position}), -1)` })
    .from(schema.card)
    .where(eq(schema.card.columnId, columnId))
    .all();
  const id = nanoid();
  const now = new Date();
  db.insert(schema.card)
    .values({
      id,
      columnId,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      position: maxPos + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return db.select().from(schema.card).where(eq(schema.card.id, id)).get()!;
}

export async function updateCard(
  userId: string,
  cardId: string,
  patch: { title?: string; description?: string | null; dueDate?: Date | null; columnId?: string },
) {
  loadCardForUser(userId, cardId);
  if (patch.columnId !== undefined) assertOwnColumn(userId, patch.columnId);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.dueDate !== undefined) updates.dueDate = patch.dueDate;
  // Move is handled separately to keep positions consistent.
  db.update(schema.card).set(updates).where(eq(schema.card.id, cardId)).run();
  return db.select().from(schema.card).where(eq(schema.card.id, cardId)).get()!;
}

export async function deleteCard(userId: string, cardId: string) {
  const card = loadCardForUser(userId, cardId);
  db.transaction((tx) => {
    tx.delete(schema.card).where(eq(schema.card.id, cardId)).run();
    // Compact positions in the source column.
    tx.update(schema.card)
      .set({ position: sql`${schema.card.position} - 1` })
      .where(and(eq(schema.card.columnId, card.columnId), gt(schema.card.position, card.position)))
      .run();
  });
}

/** Move card to (columnId, position). Other cards shift to make room. */
export async function moveCard(userId: string, cardId: string, columnId: string, position: number) {
  const card = loadCardForUser(userId, cardId);
  assertOwnColumn(userId, columnId);
  const targetCount = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(schema.card)
    .where(eq(schema.card.columnId, columnId))
    .all()[0].c;

  // Clamp position into a valid range for the destination column.
  const sameColumn = card.columnId === columnId;
  const maxAllowed = sameColumn ? targetCount - 1 : targetCount;
  const pos = Math.max(0, Math.min(position, Math.max(0, maxAllowed)));

  db.transaction((tx) => {
    if (sameColumn) {
      if (pos === card.position) return;
      if (pos < card.position) {
        // Shift items in [pos, card.position - 1] down by +1
        tx.update(schema.card)
          .set({ position: sql`${schema.card.position} + 1` })
          .where(
            and(
              eq(schema.card.columnId, columnId),
              gte(schema.card.position, pos),
              lt(schema.card.position, card.position),
            ),
          )
          .run();
      } else {
        // Shift items in [card.position + 1, pos] up by -1
        tx.update(schema.card)
          .set({ position: sql`${schema.card.position} - 1` })
          .where(
            and(
              eq(schema.card.columnId, columnId),
              gt(schema.card.position, card.position),
              lte(schema.card.position, pos),
            ),
          )
          .run();
      }
      tx.update(schema.card)
        .set({ position: pos, updatedAt: new Date() })
        .where(eq(schema.card.id, cardId))
        .run();
    } else {
      // Cross-column: compact source, open slot in destination, place card.
      tx.update(schema.card)
        .set({ position: sql`${schema.card.position} - 1` })
        .where(and(eq(schema.card.columnId, card.columnId), gt(schema.card.position, card.position)))
        .run();
      tx.update(schema.card)
        .set({ position: sql`${schema.card.position} + 1` })
        .where(and(eq(schema.card.columnId, columnId), gte(schema.card.position, pos)))
        .run();
      tx.update(schema.card)
        .set({ columnId, position: pos, updatedAt: new Date() })
        .where(eq(schema.card.id, cardId))
        .run();
    }
  });
  return db.select().from(schema.card).where(eq(schema.card.id, cardId)).get()!;
}

// ---------- Note streams ----------
/** Load the user's note streams, lazily seeding a default "Inbox" if none. */
async function getOrCreateNoteStreams(userId: string) {
  const existing = db
    .select()
    .from(schema.noteStream)
    .where(eq(schema.noteStream.userId, userId))
    .orderBy(asc(schema.noteStream.position))
    .all();
  if (existing.length > 0) return existing;

  const id = nanoid();
  db.insert(schema.noteStream)
    .values({ id, userId, name: "Inbox", position: 0, createdAt: new Date() })
    .run();
  return db
    .select()
    .from(schema.noteStream)
    .where(eq(schema.noteStream.userId, userId))
    .orderBy(asc(schema.noteStream.position))
    .all();
}

function assertOwnStream(userId: string, streamId: string) {
  const row = db
    .select({ id: schema.noteStream.id })
    .from(schema.noteStream)
    .where(and(eq(schema.noteStream.id, streamId), eq(schema.noteStream.userId, userId)))
    .limit(1)
    .get();
  if (!row) throw new Error("Stream not found");
}

/**
 * Returns the user's streams and notes. Any note with a NULL stream_id (e.g.
 * created before streams existed, or orphaned by a deleted stream) is re-homed
 * into the first stream, appended after the existing notes there.
 */
export async function getNotesData(userId: string) {
  const streams = await getOrCreateNoteStreams(userId);
  const firstStreamId = streams[0].id;

  const orphans = db
    .select()
    .from(schema.note)
    .where(and(eq(schema.note.userId, userId), isNull(schema.note.streamId)))
    .orderBy(asc(schema.note.createdAt))
    .all();
  if (orphans.length > 0) {
    const [{ maxPos } = { maxPos: -1 }] = db
      .select({ maxPos: sql<number>`COALESCE(MAX(${schema.note.position}), -1)` })
      .from(schema.note)
      .where(eq(schema.note.streamId, firstStreamId))
      .all();
    db.transaction((tx) => {
      orphans.forEach((o, i) => {
        tx.update(schema.note)
          .set({ streamId: firstStreamId, position: maxPos + 1 + i })
          .where(eq(schema.note.id, o.id))
          .run();
      });
    });
  }

  let notes = db
    .select()
    .from(schema.note)
    .where(eq(schema.note.userId, userId))
    .orderBy(asc(schema.note.position))
    .all();

  // Lazy migration: notes used to have a separate `title` column. The editor
  // is now a single canvas where the first line of `body` is the title.
  // Fold any existing title into the body and null the column. Runs at most
  // once per note: after the first call, the filter matches nothing.
  const titled = notes.filter((n) => n.title && n.title.trim() !== "");
  if (titled.length > 0) {
    db.transaction((tx) => {
      for (const n of titled) {
        const t = n.title!.trim();
        const newBody = n.body.trim() ? `${t}\n\n${n.body}` : t;
        tx.update(schema.note)
          .set({ body: newBody, title: null })
          .where(eq(schema.note.id, n.id))
          .run();
      }
    });
    notes = db
      .select()
      .from(schema.note)
      .where(eq(schema.note.userId, userId))
      .orderBy(asc(schema.note.position))
      .all();
  }

  return { streams, notes };
}

export async function createNoteStream(userId: string, name: string) {
  const [{ maxPos } = { maxPos: -1 }] = db
    .select({ maxPos: sql<number>`COALESCE(MAX(${schema.noteStream.position}), -1)` })
    .from(schema.noteStream)
    .where(eq(schema.noteStream.userId, userId))
    .all();
  const id = nanoid();
  db.insert(schema.noteStream)
    .values({ id, userId, name, position: maxPos + 1, createdAt: new Date() })
    .run();
  return db.select().from(schema.noteStream).where(eq(schema.noteStream.id, id)).get()!;
}

export async function renameNoteStream(userId: string, id: string, name: string) {
  assertOwnStream(userId, id);
  db.update(schema.noteStream).set({ name }).where(eq(schema.noteStream.id, id)).run();
}

/** Delete a stream. Its notes are moved into the first remaining stream. */
export async function deleteNoteStream(userId: string, id: string) {
  assertOwnStream(userId, id);
  const streams = db
    .select()
    .from(schema.noteStream)
    .where(eq(schema.noteStream.userId, userId))
    .orderBy(asc(schema.noteStream.position))
    .all();
  if (streams.length <= 1) throw new Error("Can't delete your only stream");

  const target = streams.find((s) => s.id !== id)!;
  const [{ maxPos } = { maxPos: -1 }] = db
    .select({ maxPos: sql<number>`COALESCE(MAX(${schema.note.position}), -1)` })
    .from(schema.note)
    .where(eq(schema.note.streamId, target.id))
    .all();
  const moving = db
    .select()
    .from(schema.note)
    .where(eq(schema.note.streamId, id))
    .orderBy(asc(schema.note.position))
    .all();
  db.transaction((tx) => {
    moving.forEach((n, i) => {
      tx.update(schema.note)
        .set({ streamId: target.id, position: maxPos + 1 + i })
        .where(eq(schema.note.id, n.id))
        .run();
    });
    tx.delete(schema.noteStream).where(eq(schema.noteStream.id, id)).run();
  });
}

// ---------- Notes ----------
function loadNoteForUser(userId: string, noteId: string) {
  const row = db
    .select()
    .from(schema.note)
    .where(and(eq(schema.note.id, noteId), eq(schema.note.userId, userId)))
    .limit(1)
    .get();
  if (!row) throw new Error("Note not found");
  return row;
}

export async function createNote(
  userId: string,
  input: { body: string; title?: string | null; streamId?: string },
) {
  const streams = await getOrCreateNoteStreams(userId);
  let targetStreamId = input.streamId;
  if (targetStreamId) {
    assertOwnStream(userId, targetStreamId);
  } else {
    targetStreamId = streams[0].id;
  }
  const [{ maxPos } = { maxPos: -1 }] = db
    .select({ maxPos: sql<number>`COALESCE(MAX(${schema.note.position}), -1)` })
    .from(schema.note)
    .where(eq(schema.note.streamId, targetStreamId))
    .all();
  const id = nanoid();
  const now = new Date();
  const title = input.title?.trim() || null;
  db.insert(schema.note)
    .values({
      id,
      userId,
      streamId: targetStreamId,
      title,
      body: input.body,
      position: maxPos + 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return db.select().from(schema.note).where(eq(schema.note.id, id)).get()!;
}

export async function updateNote(
  userId: string,
  id: string,
  patch: { body?: string; title?: string | null },
) {
  loadNoteForUser(userId, id);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.body !== undefined) updates.body = patch.body;
  if (patch.title !== undefined) updates.title = patch.title?.trim() || null;
  db.update(schema.note).set(updates).where(eq(schema.note.id, id)).run();
  return db.select().from(schema.note).where(eq(schema.note.id, id)).get()!;
}

export async function deleteNote(userId: string, id: string) {
  const note = loadNoteForUser(userId, id);
  db.transaction((tx) => {
    tx.delete(schema.note).where(eq(schema.note.id, id)).run();
    if (note.streamId) {
      tx.update(schema.note)
        .set({ position: sql`${schema.note.position} - 1` })
        .where(and(eq(schema.note.streamId, note.streamId), gt(schema.note.position, note.position)))
        .run();
    }
  });
}

/** Move a note to (streamId, position), shifting other notes to make room. */
export async function moveNote(userId: string, noteId: string, streamId: string, position: number) {
  const note = loadNoteForUser(userId, noteId);
  assertOwnStream(userId, streamId);
  const targetCount = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(schema.note)
    .where(eq(schema.note.streamId, streamId))
    .all()[0].c;

  const sameStream = note.streamId === streamId;
  const maxAllowed = sameStream ? targetCount - 1 : targetCount;
  const pos = Math.max(0, Math.min(position, Math.max(0, maxAllowed)));

  db.transaction((tx) => {
    if (sameStream) {
      if (pos === note.position) return;
      if (pos < note.position) {
        tx.update(schema.note)
          .set({ position: sql`${schema.note.position} + 1` })
          .where(
            and(
              eq(schema.note.streamId, streamId),
              gte(schema.note.position, pos),
              lt(schema.note.position, note.position),
            ),
          )
          .run();
      } else {
        tx.update(schema.note)
          .set({ position: sql`${schema.note.position} - 1` })
          .where(
            and(
              eq(schema.note.streamId, streamId),
              gt(schema.note.position, note.position),
              lte(schema.note.position, pos),
            ),
          )
          .run();
      }
      tx.update(schema.note)
        .set({ position: pos, updatedAt: new Date() })
        .where(eq(schema.note.id, noteId))
        .run();
    } else {
      if (note.streamId) {
        tx.update(schema.note)
          .set({ position: sql`${schema.note.position} - 1` })
          .where(
            and(eq(schema.note.streamId, note.streamId), gt(schema.note.position, note.position)),
          )
          .run();
      }
      tx.update(schema.note)
        .set({ position: sql`${schema.note.position} + 1` })
        .where(and(eq(schema.note.streamId, streamId), gte(schema.note.position, pos)))
        .run();
      tx.update(schema.note)
        .set({ streamId, position: pos, updatedAt: new Date() })
        .where(eq(schema.note.id, noteId))
        .run();
    }
  });
  return db.select().from(schema.note).where(eq(schema.note.id, noteId)).get()!;
}
