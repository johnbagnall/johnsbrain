import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader userName={session.user.name} userEmail={session.user.email} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
          <nav className="flex gap-2 text-sm">
            <Link href="/board" className="text-muted-foreground hover:underline">
              ← Back to board
            </Link>
          </nav>
          <nav className="flex gap-4 border-b">
            <Link href="/settings" className="py-2 border-b-2 border-transparent hover:border-foreground">
              Account
            </Link>
            <Link href="/settings/api-keys" className="py-2 border-b-2 border-transparent hover:border-foreground">
              API keys
            </Link>
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
