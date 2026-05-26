import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: filePath,
  },
} satisfies Config;
