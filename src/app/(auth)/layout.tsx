import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/" className="font-semibold">
          John&apos;s Brain
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
