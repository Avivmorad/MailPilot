"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Logo } from "@/components/brand/logo";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authUserMessage } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push("/login?notice=password_updated");
      router.refresh();
    } catch (err) {
      setError(authUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-muted/30 relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <SkipToContent />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="mb-8">
        <Link
          href="/"
          aria-label="Back to home"
          className="focus-visible:ring-ring rounded-lg focus-visible:ring-3 focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>

      <main id="main-content" tabIndex={-1} className="w-full max-w-sm">
        <Card className="w-full shadow-sm">
          <CardHeader>
            <CardTitle>
              <h1 className="text-base font-semibold">Choose a new password</h1>
            </CardTitle>
            <CardDescription>
              Use the link from your email. If this page says the link expired, request another
              reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-sm font-medium">
                  New password
                </label>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  maxLength={72}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="text-foreground text-sm font-medium underline underline-offset-4"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide passwords" : "Show passwords"}
                </button>
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                {loading ? "Please wait…" : "Update password"}
              </Button>
            </form>
            <p className="text-muted-foreground mt-4 text-center text-sm">
              <Link
                href="/login"
                className="text-foreground font-medium underline underline-offset-4"
              >
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
