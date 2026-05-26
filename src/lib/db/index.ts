import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;

// Ensure the directory exists.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
try {
  mkdirSync(dirname(filePath), { recursive: true });
} catch {
  // ignore
}

const sqlite = new Database(filePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
