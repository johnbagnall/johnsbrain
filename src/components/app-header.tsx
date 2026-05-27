"use client";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string }[] = [
  { href: "/board", label: "Work" },
  { href: "/epa", label: "EPA" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
      )}
    >
      {label}
    </Link>
  );
}

export function AppHeader({ userName, userEmail }: { userName: string; userEmail: string }) {
  const router = useRouter();
  async function onSignOut() {
    await signOut();
    toast.success("Signed out");
    router.push("/sign-in");
    router.refresh();
  }
  const initial = (userName?.[0] || userEmail?.[0] || "?").toUpperCase();
  return (
    <header className="flex items-center justify-between px-4 h-14 border-b bg-background sticky top-0 z-30">
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/board" aria-label="John's Brain — home">
          <Image
            src="/logo.png"
            alt="John's Brain"
            width={32}
            height={32}
            className="dark:invert"
            priority
          />
        </Link>
        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {initial}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate">{userName || "Account"}</span>
                <span className="text-xs font-normal text-muted-foreground truncate">{userEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserIcon className="mr-2 h-4 w-4" /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/api-keys">
                <Settings className="mr-2 h-4 w-4" /> API keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
