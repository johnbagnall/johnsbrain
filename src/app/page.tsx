import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b">
        <div className="font-semibold">John&apos;s Brain</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Sign up</Link>
          </Button>
        </div>
      </header>
      <section className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            A personal Kanban — with an MCP server.
          </h1>
          <p className="text-lg text-muted-foreground">
            Track your to-dos on a self-hosted board. Then let Claude (or any MCP-compatible AI)
            read and write cards on your behalf — including from meeting notes.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
