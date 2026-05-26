import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listApiKeysForUser } from "@/lib/api-keys";
import { ApiKeysManager } from "./api-keys-manager";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const keys = await listApiKeysForUser(session.user.id);
  return (
    <ApiKeysManager
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
        revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
      }))}
    />
  );
}
