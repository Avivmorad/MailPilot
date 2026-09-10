import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActionControls } from "@/components/actions/action-controls";
import { AppShell } from "@/components/layout/app-shell";
import { AppHeader } from "@/components/nav/app-header";
import { ThreadFeedback } from "@/components/threads/thread-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaBadge } from "@/components/ui/meta-badge";
import { getSessionUser } from "@/lib/supabase/auth";
import { getThreadDetailForUser } from "@/lib/threads/queries";
import { formatDate, formatDateTime } from "@/lib/ui/format";
import { labelForDirection } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { id } = await params;
  const thread = await getThreadDetailForUser(user.id, id);
  if (!thread) {
    notFound();
  }

  const lowConfidence = thread.confidence != null && thread.confidence < 0.55;

  return (
    <AppShell header={<AppHeader email={user.email} current="thread" />} width="narrow">
      <div>
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-foreground mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl" dir="auto">
          {thread.shortDisplayTitle ?? thread.subject ?? "Thread"}
        </h1>
        {thread.subject ? <p className="text-muted-foreground mt-1 text-sm">{thread.subject}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {thread.status ? <MetaBadge kind="status" value={thread.status} /> : null}
        {thread.importance ? <MetaBadge kind="importance" value={thread.importance} /> : null}
        {thread.urgency && thread.urgency !== "none" ? (
          <MetaBadge kind="urgency" value={thread.urgency} />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          {thread.summary ? (
            <p dir="auto">{thread.summary}</p>
          ) : (
            <p className="text-muted-foreground">No analysis yet.</p>
          )}
          {thread.actionSummary ? (
            <p className="bg-muted/60 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Do: </span>
              <span dir="auto">{thread.actionSummary}</span>
            </p>
          ) : null}
          {thread.actionReason ? (
            <p>
              <span className="text-muted-foreground">Why: </span>
              <span dir="auto">{thread.actionReason}</span>
            </p>
          ) : null}
          {thread.waitingFor ? (
            <p>
              <span className="text-muted-foreground">Waiting on: </span>
              {thread.waitingFor}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Deadline {formatDate(thread.deadline)}
            {thread.deadlineText ? ` (${thread.deadlineText})` : ""} · Last activity{" "}
            {formatDateTime(thread.latestMessageAt)}
          </p>
          {lowConfidence ? (
            <p className="text-amber-800 text-sm dark:text-amber-200">
              Low classification confidence ({thread.confidence?.toFixed(2)}). Double-check before acting.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <a
              href={thread.gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Open in Gmail
            </a>
            {thread.actionId ? (
              <ActionControls actionId={thread.actionId} status={thread.actionStatus ?? "OPEN"} />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {thread.messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No stored message metadata.</p>
          ) : (
            thread.messages.map((message) => (
              <div key={message.id} className="border-border/70 border-b py-3 last:border-0 last:pb-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-foreground text-sm font-semibold">
                    {message.senderName ?? message.senderEmail ?? "Unknown"}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {labelForDirection(message.direction)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">{formatDateTime(message.receivedAt)}</p>
                </div>
                {message.snippet ? (
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed" dir="auto">
                    {message.snippet}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ThreadFeedback threadId={thread.id} />
    </AppShell>
  );
}
