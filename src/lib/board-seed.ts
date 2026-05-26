import { nanoid } from "nanoid";
import { db, schema } from "./db";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"] as const;
const DEFAULT_NOTE_STREAMS = ["Inbox"] as const;

export async function seedDefaultBoard(userId: string) {
  const now = new Date();
  const boardId = nanoid();
  db.insert(schema.board)
    .values({ id: boardId, userId, name: "My Board", createdAt: now })
    .run();
  for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
    db.insert(schema.column)
      .values({
        id: nanoid(),
        boardId,
        name: DEFAULT_COLUMNS[i],
        position: i,
        createdAt: now,
      })
      .run();
  }
  for (let i = 0; i < DEFAULT_NOTE_STREAMS.length; i++) {
    db.insert(schema.noteStream)
      .values({
        id: nanoid(),
        userId,
        name: DEFAULT_NOTE_STREAMS[i],
        position: i,
        createdAt: now,
      })
      .run();
  }
  return boardId;
}
