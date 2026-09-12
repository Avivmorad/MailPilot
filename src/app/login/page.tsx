"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Logo } from "@/components/brand/logo";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/onboarding");
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setNotice("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Is Supabase configured in .env.local?",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-muted/30 relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <SkipToContent />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="mb-8">
        <Link href="/" aria-label="Back to home" className="rounded-lg focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none">
          <Logo />
        </Link>
      </div>

      <main id="main-content" tabIndex={-1} className="w-full max-w-sm">
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Sign in" : "Create your account"}</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Welcome back. Sign in to your MailPilot account."
              : "Sign up to start triaging your inbox."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClassName}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
                {notice}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <p className="text-muted-foreground mt-4 text-center text-sm">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="text-foreground font-medium underline underline-offset-4"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
