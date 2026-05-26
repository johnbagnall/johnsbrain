#!/bin/sh
set -e

# Apply pending Drizzle migrations against the mounted database.
node -e "
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const url = process.env.DATABASE_URL || 'file:/data/app.db';
const file = url.startsWith('file:') ? url.slice(5) : url;
fs.mkdirSync(path.dirname(file), { recursive: true });
const sqlite = new Database(file);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
migrate(drizzle(sqlite), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
sqlite.close();
console.log('[entrypoint] migrations applied → ' + file);
"

exec "$@"
