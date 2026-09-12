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
    title: "What happened?",
    body: "A digest of leftover FYI — useful updates, not receipts, OTPs, or marketing.",
  },
  {
    icon: ListChecks,
    title: "What needs me?",
    body: "Open tasks with a next step — reply, review, pay — ranked by urgency and deadline.",
  },
  {
    icon: Clock3,
    title: "What am I waiting for?",
    body: "Threads where you already acted and the next move is on someone else.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "Thread-aware AI triage",
    body: "Classifies the current state of a whole thread — importance, action, reply, waiting, urgency — not just the latest message.",
  },
  {
    icon: ListChecks,
    title: "One action per thread",
    body: "Six emails about one task become a single action item that moves OPEN → WAITING → COMPLETED as the conversation evolves.",
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
    body: "Re-scanning the same mail never creates duplicate messages, actions, digests, or labels.",
  },
];

const previewColumns = [
  {
    tab: "Open",
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
    tab: "Waiting",
    accent: "border-l-sky-500",
    hint: "You already acted",
    items: [
      {
        title: "Question sent to the hotel",
        meta: "Booking.com · Waiting on the hotel",
        body: "They confirmed your smart-TV question was forwarded. Nothing for you until they reply.",
      },
    ],
  },
  {
    tab: "Summary",
    accent: "border-l-zinc-400",
    hint: "Useful FYI, not a task",
    items: [
      {
        title: "Weekly product changelog",
        meta: "Linear · FYI",
        body: "Shipped: placement reasons, undo, and a change-focused dashboard.",
      },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SkipToContent />
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="MailPilot home" className="rounded-lg focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none">
            <Logo />
          </Link>
          <nav aria-label="Landing" className="flex items-center gap-2">
            <a href="#preview" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Example
            </a>
            <a href="#features" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Features
            </a>
            <ThemeToggle />
            <a href="/login" className={buttonVariants({ size: "sm" })}>
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-10 text-center">
          <Badge variant="secondary" className="mb-6">
            Inbox triage for Gmail
          </Badge>
          <h1 className="text-foreground mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Turn your inbox into a triage system, not a prettier list of emails.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
            MailPilot connects to Gmail, understands each thread in context, and splits mail into
            Open, Waiting, and Summary — three separate lists, not one mixed feed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/login" className={buttonVariants({ size: "lg" })}>
              Sign in
              <ArrowRight className="size-4" />
            </a>
            <a href="#preview" className={buttonVariants({ variant: "outline", size: "lg" })}>
              See an example
            </a>
          </div>
        </section>

        <section id="preview" className="border-border/60 bg-muted/30 border-y">
          <div className="mx-auto w-full max-w-6xl px-6 py-12">
            <div className="mb-8 text-center">
              <h2 className="text-foreground text-2xl font-bold tracking-tight">How a morning inbox looks</h2>
              <p className="text-muted-foreground mt-2">
                After a scan, MailPilot does not dump 32 emails into one list. It keeps tasks, waiting, and FYI apart.
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
                      <article key={item.title} className="bg-background/80 rounded-lg p-3 ring-1 ring-foreground/10">
                        <h3 className="text-foreground text-sm font-semibold tracking-tight">{item.title}</h3>
                        <p className="text-muted-foreground mt-0.5 text-xs">{item.meta}</p>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.body}</p>
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
            <p className="text-muted-foreground mt-2">The product principles that shape every part of the build.</p>
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
            <Link href="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground underline-offset-4 hover:underline">
              Terms
            </Link>
            <span>MailPilot. Not affiliated with Google.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
