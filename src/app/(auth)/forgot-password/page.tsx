"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [pending, setPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "");
    setPending(true);
    const { error } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Something went wrong");
      return;
    }
    setSubmitted(true);
    toast.success("If that email exists, a reset link has been sent.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          We&apos;ll send you a link to reset your password. (Email delivery is not wired up in v1 —
          this is a stub.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm">If an account exists for that email, a reset link has been sent.</p>
            <Button asChild className="w-full">
              <Link href="/sign-in">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Remembered it?{" "}
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
