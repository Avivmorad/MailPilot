import { ArrowRight, Clock3, Inbox, ListChecks, ShieldCheck, Sparkles, Tag } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const questions = [
  {
    icon: Inbox,
    title: "For You",
    body: "Useful updates, not receipts, OTPs, or marketing.",
  },
  {
    icon: ListChecks,
    title: "Actions",
    body: "Actions with a next step — reply, review, pay — ranked by urgency and deadline.",
  },
  {
    icon: Clock3,
    title: "What's pending?",
    body: "Threads where you already acted and the next move is on someone else.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "Thread-aware AI triage",
    body: "Classifies the current state of a whole thread — importance, action, reply, pending, urgency — not just the latest message.",
  },
  {
    icon: ListChecks,
    title: "One action per thread",
    body: "Six emails about one task become a single action item that moves Actions → Pending → Closed as the conversation evolves.",
  },
  {
    icon: Tag,
    title: "Gmail labels, in sync",
    body: "Applies managed MailPilot/ labels back to Gmail so your triage is visible everywhere — without touching your own labels.",
  },
  {
    icon: Clock3,
    title: "Scheduled & incremental scans",
    body: "An initial lookback scan, then incremental syncs via the Gmail History API so only changed threads are reanalyzed.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-first by default",
    body: "Raw email bodies aren't persisted, refresh tokens are encrypted at rest, and bodies and tokens never hit the logs.",
  },
  {
    icon: Inbox,
    title: "Idempotent by design",
    body: "Re-scanning the same mail never creates duplicate messages, actions, History entries, or labels.",
  },
];

const previewColumns = [
  {
    tab: "Actions",
    accent: "border-l-orange-500",
    hint: "Needs a next step from you",
    items: [
      {
        title: "University registration",
        meta: "Registrar · Due 12 Sep",
        body: "Do: Choose courses and submit registration before the deadline.",
      },
      {
        title: "Security alert: new Windows login",
        meta: "Google · Urgent",
        body: "Do: Confirm the sign-in was yours, or secure the account.",
      },
    ],
  },
  {
    tab: "Pending",
    accent: "border-l-sky-500",
    hint: "You already acted",
    items: [
      {
        title: "Question sent to the hotel",
        meta: "Booking.com · Pending on the hotel",
        body: "They confirmed your smart-TV question was forwarded. Nothing for you until they reply.",
      },
    ],
  },
  {
    tab: "For You",
    accent: "border-l-zinc-400",
    hint: "Useful to know, not a task",
    items: [
      {
        title: "Weekly product changelog",
        meta: "Linear · For You",
        body: "Shipped: placement reasons, undo, and a change-focused dashboard.",
      },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SkipToContent />
      <header className="border-border/60 bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href="/"
            aria-label="MailPriority home"
            className="focus-visible:ring-ring shrink-0 rounded-lg focus-visible:ring-3 focus-visible:outline-none"
          >
            <Logo />
          </Link>
          <nav aria-label="Landing" className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a
              href="#preview"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "hidden sm:inline-flex",
              })}
            >
              Example
            </a>
            <a
              href="#features"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "hidden sm:inline-flex",
              })}
            >
              Features
            </a>
            <ThemeToggle className="size-10 sm:size-8" />
            <a
              href="/login"
              className={buttonVariants({ size: "sm", className: "min-h-10 px-3 sm:min-h-8" })}
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="border-border/60 relative overflow-hidden border-b bg-[radial-gradient(circle_at_80%_15%,var(--accent),transparent_42%)]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[.9fr_1.1fr] lg:gap-12 lg:py-24">
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
              <Badge variant="secondary" className="mb-5 sm:mb-6">
                A clearer way to handle Gmail
              </Badge>
              <h1 className="text-foreground max-w-xl text-4xl leading-[1.08] font-semibold tracking-[-.04em] text-balance sm:text-5xl sm:tracking-[-.05em] lg:text-6xl">
                Your inbox, <span className="text-primary">under control.</span>
              </h1>
              <p className="text-muted-foreground mt-5 max-w-lg text-base leading-relaxed text-pretty sm:mt-6 sm:text-lg">
                MailPriority turns busy email threads into a short list of Actions, Pending, and For
                You.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
                <a
                  href="/login"
                  className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
                >
                  Get started with Gmail <ArrowRight className="size-4" />
                </a>
                <a
                  href="#preview"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "w-full sm:w-auto",
                  })}
                >
                  See an example
                </a>
              </div>
              <p className="text-muted-foreground mt-5 text-xs">
                No automatic sending or deleting emails.
              </p>
            </div>
            <div className="border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 overflow-hidden rounded-2xl border shadow-sm motion-safe:duration-700">
              <div className="border-border flex items-center justify-between border-b px-5 py-4">
                <span className="text-sm font-semibold">Your daily overview</span>
                <span className="text-muted-foreground text-xs">Example inbox</span>
              </div>
              <div className="border-border bg-muted/40 grid grid-cols-3 border-b">
                {[
                  ["02", "Actions"],
                  ["01", "Pending"],
                  ["01", "For You"],
                ].map(([count, label]) => (
                  <div key={label} className="border-border border-r px-4 py-4 last:border-0">
                    <p className="text-2xl font-semibold tabular-nums">{count}</p>
                    <p className="text-muted-foreground text-xs">{label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 p-4">
                {previewColumns.map((column) => (
                  <div
                    key={column.tab}
                    className={`border-border rounded-xl border border-l-4 ${column.accent} bg-background p-4`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold">{column.items[0].title}</h2>
                      <span className="text-muted-foreground shrink-0 text-xs">{column.tab}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{column.items[0].meta}</p>
                    <p className="text-muted-foreground mt-2 text-sm">{column.items[0].body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="preview" className="border-border/60 bg-muted/30 border-y">
          <div className="mx-auto w-full max-w-6xl px-6 py-12">
            <div className="mb-8 text-center">
              <h2 className="text-foreground text-2xl font-bold tracking-tight">
                How a morning inbox looks
              </h2>
              <p className="text-muted-foreground mt-2">
                After a scan, MailPriority does not dump 32 emails into one list. It keeps tasks,
                pending, and For You apart.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {previewColumns.map((column) => (
                <Card key={column.tab} className={`border-l-4 ${column.accent}`}>
                  <CardHeader>
                    <CardTitle>{column.tab}</CardTitle>
                    <CardDescription>{column.hint}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {column.items.map((item) => (
                      <article
                        key={item.title}
                        className="bg-background/80 ring-foreground/10 rounded-lg p-3 ring-1"
                      >
                        <h3 className="text-foreground text-sm font-semibold tracking-tight">
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground mt-0.5 text-xs">{item.meta}</p>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {item.body}
                        </p>
                      </article>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {questions.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="mb-8 text-center">
            <h2 className="text-foreground text-2xl font-bold tracking-tight">What it does</h2>
            <p className="text-muted-foreground mt-2">
              The product principles that shape every part of the build.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm sm:flex-row">
          <Logo showWordmark={false} />
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/privacy"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Terms
            </Link>
            <span>MailPriority. Not affiliated with Google.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
