import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/" aria-label="John's Brain — home">
          <Image
            src="/logo.png"
            alt="John's Brain"
            width={36}
            height={36}
            className="dark:invert"
            priority
          />
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
