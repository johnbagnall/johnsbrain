"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "./auth";
import * as data from "./data";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

const titleSchema = z.string().trim().min(1, "Title is required").max(500);
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

export async function createCardAction(input: {
  title: string;
  description?: string | null;
  columnId?: string;
  dueDate?: string | null;
}) {
  const userId = await requireUser();
  const parsed = z
    .object({
      title: titleSchema,
      description: z.string().max(10_000).nullish(),
      columnId: z.string().optional(),
      dueDate: z.string().nullish(),
    })
    .parse(input);
  const card = await data.createCard(userId, {
    title: parsed.title,
    description: parsed.description ?? null,
    columnId: parsed.columnId,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
  });
  revalidatePath("/board");
  return card;
}

export async function updateCardAction(input: {
  id: string;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
}) {
  const userId = await requireUser();
  const parsed = z
    .object({
      id: z.string(),
      title: titleSchema.optional(),
      description: z.string().max(10_000).nullish(),
      dueDate: z.string().nullish(),
    })
    .parse(input);
  const card = await data.updateCard(userId, parsed.id, {
    title: parsed.title,
    description: parsed.description === undefined ? undefined : parsed.description,
    dueDate: parsed.dueDate === undefined ? undefined : parsed.dueDate ? new Date(parsed.dueDate) : null,
  });
  revalidatePath("/board");
  return card;
}

export async function moveCardAction(input: { id: string; columnId: string; position: number }) {
  const userId = await requireUser();
  const parsed = z
    .object({ id: z.string(), columnId: z.string(), position: z.number().int().min(0) })
    .parse(input);
  const card = await data.moveCard(userId, parsed.id, parsed.columnId, parsed.position);
  revalidatePath("/board");
  return card;
}

export async function deleteCardAction(input: { id: string }) {
  const userId = await requireUser();
  const parsed = z.object({ id: z.string() }).parse(input);
  await data.deleteCard(userId, parsed.id);
  revalidatePath("/board");
}

export async function createColumnAction(input: { name: string }) {
  const userId = await requireUser();
  const parsed = z.object({ name: nameSchema }).parse(input);
  const column = await data.createColumn(userId, parsed.name);
  revalidatePath("/board");
  return column;
}

export async function renameColumnAction(input: { id: string; name: string }) {
  const userId = await requireUser();
  const parsed = z.object({ id: z.string(), name: nameSchema }).parse(input);
  await data.renameColumn(userId, parsed.id, parsed.name);
  revalidatePath("/board");
}

export async function deleteColumnAction(input: { id: string }) {
  const userId = await requireUser();
  const parsed = z.object({ id: z.string() }).parse(input);
  await data.deleteColumn(userId, parsed.id);
  revalidatePath("/board");
}

export async function reorderColumnsAction(input: { orderedIds: string[] }) {
  const userId = await requireUser();
  const parsed = z.object({ orderedIds: z.array(z.string()).min(1) }).parse(input);
  await data.reorderColumns(userId, parsed.orderedIds);
  revalidatePath("/board");
}

// ---------- Note streams ----------
export async function createNoteStreamAction(input: { name: string }) {
  const userId = await requireUser();
  const { name } = z.object({ name: nameSchema }).parse(input);
  const stream = await data.createNoteStream(userId, name);
  revalidatePath("/board");
  return stream;
}

export async function renameNoteStreamAction(input: { id: string; name: string }) {
  const userId = await requireUser();
  const parsed = z.object({ id: z.string(), name: nameSchema }).parse(input);
  await data.renameNoteStream(userId, parsed.id, parsed.name);
  revalidatePath("/board");
}

export async function deleteNoteStreamAction(input: { id: string }) {
  const userId = await requireUser();
  const { id } = z.object({ id: z.string() }).parse(input);
  await data.deleteNoteStream(userId, id);
  revalidatePath("/board");
}

// ---------- Notes ----------
const noteBodySchema = z.string().trim().min(1, "Note can't be empty").max(20_000);

const noteTitleSchema = z.string().trim().max(500).nullish();

export async function createNoteAction(input: {
  body: string;
  title?: string | null;
  streamId?: string;
}) {
  const userId = await requireUser();
  const parsed = z
    .object({
      body: noteBodySchema,
      title: noteTitleSchema,
      streamId: z.string().optional(),
    })
    .parse(input);
  const note = await data.createNote(userId, {
    body: parsed.body,
    title: parsed.title ?? null,
    streamId: parsed.streamId,
  });
  revalidatePath("/board");
  return note;
}

export async function updateNoteAction(input: {
  id: string;
  body?: string;
  title?: string | null;
}) {
  const userId = await requireUser();
  const parsed = z
    .object({
      id: z.string(),
      body: noteBodySchema.optional(),
      title: noteTitleSchema,
    })
    .parse(input);
  const note = await data.updateNote(userId, parsed.id, {
    body: parsed.body,
    title: parsed.title === undefined ? undefined : parsed.title ?? null,
  });
  revalidatePath("/board");
  return note;
}

export async function moveNoteAction(input: { id: string; streamId: string; position: number }) {
  const userId = await requireUser();
  const parsed = z
    .object({ id: z.string(), streamId: z.string(), position: z.number().int().min(0) })
    .parse(input);
  const note = await data.moveNote(userId, parsed.id, parsed.streamId, parsed.position);
  revalidatePath("/board");
  return note;
}

export async function deleteNoteAction(input: { id: string }) {
  const userId = await requireUser();
  const { id } = z.object({ id: z.string() }).parse(input);
  await data.deleteNote(userId, id);
  revalidatePath("/board");
}
