import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function EpaPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader userName={session.user.name} userEmail={session.user.email} />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">EPA</h1>
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </div>
      </main>
    </div>
  );
}
