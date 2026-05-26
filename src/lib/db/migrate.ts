import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
mkdirSync(dirname(filePath), { recursive: true });

const sqlite = new Database(filePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
sqlite.close();
console.log("[migrate] complete →", filePath);
