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
    body: "A digest of everything that arrived in the period, summarized so you don't have to open each thread.",
  },
  {
    icon: ListChecks,
    title: "What needs me?",
    body: "An Action Center of concrete next steps — reply, review, approve, pay — ranked by urgency and deadline.",
  },
  {
    icon: Clock3,
    title: "What am I waiting for?",
    body: "A Waiting list of threads where you already acted and the ball is in someone else's court.",
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

const dashboardStats = [
  { label: "Processed", value: "32" },
  { label: "Important", value: "6" },
  { label: "Open tasks", value: "5" },
  { label: "Waiting", value: "3" },
];

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
        <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-16 text-center">
          <Badge variant="secondary" className="mb-6">
            Inbox triage for Gmail
          </Badge>
          <h1 className="text-foreground mx-auto max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Turn your inbox into a triage system, not a prettier list of emails.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
            MailPilot connects to Gmail, understands each thread in context, and answers the only
            three questions that matter about your inbox.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/login" className={buttonVariants({ size: "lg" })}>
              Sign in
              <ArrowRight className="size-4" />
            </a>
            <a href="#features" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Explore features
            </a>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {questions.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="preview" className="border-border/60 bg-muted/30 border-y">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="mb-8 text-center">
              <h2 className="text-foreground text-2xl font-bold tracking-tight">Your inbox, under control</h2>
              <p className="text-muted-foreground mt-2">
                Open tasks, waiting items, and an inbox digest — kept as separate lists.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Inbox overview</CardTitle>
                <CardDescription>
                  Last scan 14:10 · 27 emails processed · Next scan 15:10
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {dashboardStats.map((stat) => (
                    <div key={stat.label} className="border-border/60 rounded-lg border p-4">
                      <div className="text-3xl font-semibold tabular-nums">{stat.value}</div>
                      <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="border-border/60 rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge>Action</Badge>
                    <Badge variant="secondary">Reply</Badge>
                    <Badge variant="outline">Due Sep 12</Badge>
                  </div>
                  <div className="text-foreground font-semibold tracking-tight">University registration</div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Do: Choose courses and submit registration. Why: Registration closes after the
                    deadline.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
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
                    <Icon className="size-5" />
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
