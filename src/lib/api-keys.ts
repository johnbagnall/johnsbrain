import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "./db";

const KEY_PREFIX = "kmcp_";

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  // 32 bytes → ~43 base64url chars. Combined with prefix, ~48 chars total.
  const random = crypto.randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = plaintext.slice(0, 12); // shown in lists for identification
  const hash = hashApiKey(plaintext);
  return { plaintext, prefix, hash };
}

/**
 * Hash an API key with SHA-256. We don't salt per-row: the key itself is
 * already 256 bits of randomness from a CSPRNG, so a salt adds nothing —
 * rainbow tables against random 256-bit secrets are not feasible. Constant-
 * time comparison is provided by indexed lookup of the digest.
 */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export async function createApiKey(userId: string, name: string) {
  const { plaintext, prefix, hash } = generateApiKey();
  const id = nanoid();
  const now = new Date();
  db.insert(schema.apiKey)
    .values({ id, userId, name, keyHash: hash, keyPrefix: prefix, createdAt: now })
    .run();
  return { id, plaintext, prefix, name, createdAt: now };
}

export async function listApiKeysForUser(userId: string) {
  return db
    .select({
      id: schema.apiKey.id,
      name: schema.apiKey.name,
      prefix: schema.apiKey.keyPrefix,
      lastUsedAt: schema.apiKey.lastUsedAt,
      createdAt: schema.apiKey.createdAt,
      revokedAt: schema.apiKey.revokedAt,
    })
    .from(schema.apiKey)
    .where(eq(schema.apiKey.userId, userId))
    .all();
}

export async function revokeApiKey(userId: string, id: string) {
  db.update(schema.apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKey.id, id), eq(schema.apiKey.userId, userId)))
    .run();
}

/** Look up an API key by its plaintext value. Returns the user id, or null. */
export async function authenticateApiKey(plaintext: string): Promise<{ userId: string; keyId: string } | null> {
  if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null;
  const hash = hashApiKey(plaintext);
  const row = db
    .select({ id: schema.apiKey.id, userId: schema.apiKey.userId })
    .from(schema.apiKey)
    .where(and(eq(schema.apiKey.keyHash, hash), isNull(schema.apiKey.revokedAt)))
    .limit(1)
    .get();
  if (!row) return null;
  // Best-effort last-used update.
  db.update(schema.apiKey).set({ lastUsedAt: new Date() }).where(eq(schema.apiKey.id, row.id)).run();
  return { userId: row.userId, keyId: row.id };
}
