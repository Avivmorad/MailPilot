"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authUserMessage } from "@/lib/auth/messages";
import { passwordResetRedirectTo } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const QUERY_NOTICES: Record<string, string> = {
  confirmed: "Email confirmed. You can sign in now.",
  password_updated: "Password updated. Sign in with your new password.",
  reset_ready: "Choose a new password to finish resetting your account.",
};

const QUERY_ERRORS: Record<string, string> = {
  auth_link: "This confirmation or reset link is invalid or has expired. Request a new one.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-muted/30 relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <SkipToContent />
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="mb-8">
        <Link
          href="/"
          aria-label="Back to home"
          className="rounded-lg focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>
      <main id="main-content" tabIndex={-1} className="w-full max-w-sm">
        {children ?? (
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        <Link href="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">
          Privacy
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terms" className="hover:text-foreground underline-offset-4 hover:underline">
          Terms
        </Link>
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    QUERY_ERRORS[searchParams.get("error") ?? ""] ?? null,
  );
  const [notice, setNotice] = useState<string | null>(
    QUERY_NOTICES[searchParams.get("notice") ?? ""] ?? null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldError(null);

    if (!email.includes("@") || email.trim().length < 3) {
      setFieldError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "forgot") {
        const origin = window.location.origin;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: passwordResetRedirectTo(origin),
        });
        if (resetError) throw resetError;
        setNotice("If an account exists for that email, we sent a reset link. Check your inbox.");
        return;
      }

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.push("/onboarding");
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) throw signUpError;
      setNotice("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
    } catch (err) {
      setError(authUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginShell>
      <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base font-semibold">
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
            </h1>
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Welcome back. Sign in to your MailPilot account."
              : mode === "signup"
                ? "Sign up to start triaging your inbox."
                : "We will email a reset link if that address has an account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "email-error" : undefined}
              />
              {fieldError ? (
                <p id="email-error" className="text-destructive text-sm" role="alert">
                  {fieldError}
                </p>
              ) : null}
            </div>

            {mode !== "forgot" ? (
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClassName}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="text-foreground text-sm font-medium underline underline-offset-4"
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
              </div>
            ) : null}

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
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Sign up"
                    : "Send reset link"}
            </Button>
          </form>

          {mode === "signin" ? (
            <p className="mt-3 text-center text-sm">
              <button
                type="button"
                className="text-foreground font-medium underline underline-offset-4"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setNotice(null);
                  setFieldError(null);
                }}
              >
                Forgot password?
              </button>
            </p>
          ) : null}

          <p className="text-muted-foreground mt-4 text-center text-sm">
            {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              className="text-foreground font-medium underline underline-offset-4"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
                setNotice(null);
                setFieldError(null);
              }}
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
            {mode === "forgot" ? (
              <>
                <span aria-hidden="true"> · </span>
                <button
                  type="button"
                  className="text-foreground font-medium underline underline-offset-4"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : null}
          </p>
        </CardContent>
      </Card>
    </LoginShell>
  );
}
