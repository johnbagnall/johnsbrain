"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "./auth";
import { createApiKey, revokeApiKey } from "./api-keys";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createApiKeyAction(input: { name: string }) {
  const userId = await requireUser();
  const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(input);
  const created = await createApiKey(userId, name);
  revalidatePath("/settings/api-keys");
  return created;
}

export async function revokeApiKeyAction(input: { id: string }) {
  const userId = await requireUser();
  const { id } = z.object({ id: z.string() }).parse(input);
  await revokeApiKey(userId, id);
  revalidatePath("/settings/api-keys");
}
