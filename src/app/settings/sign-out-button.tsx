"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  async function onClick() {
    await signOut();
    toast.success("Signed out");
    router.push("/sign-in");
    router.refresh();
  }
  return (
    <Button variant="destructive" onClick={onClick}>
      Sign out
    </Button>
  );
}
