import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getBoardForUser, getNotesData } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { BoardTabs } from "@/components/board/board-tabs";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const [{ columns, cards }, { streams, notes }] = await Promise.all([
    getBoardForUser(session.user.id),
    getNotesData(session.user.id),
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader userName={session.user.name} userEmail={session.user.email} />
      <BoardTabs
        columns={columns.map((c) => ({ id: c.id, name: c.name, position: c.position }))}
        cards={cards.map((c) => ({
          id: c.id,
          columnId: c.columnId,
          title: c.title,
          description: c.description,
          dueDate: c.dueDate ? c.dueDate.toISOString() : null,
          position: c.position,
        }))}
        streams={streams.map((s) => ({ id: s.id, name: s.name, position: s.position }))}
        notes={notes.map((n) => ({
          id: n.id,
          streamId: n.streamId ?? streams[0].id,
          title: n.title,
          body: n.body,
          position: n.position,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
