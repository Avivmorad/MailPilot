import { notFound, redirect } from "next/navigation";

import { ActionControls } from "@/components/actions/action-controls";
import { AppHeader } from "@/components/nav/app-header";
import { ThreadFeedback } from "@/components/threads/thread-feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/supabase/auth";
import { getThreadDetailForUser } from "@/lib/threads/queries";
import { formatDate, formatDateTime } from "@/lib/ui/format";

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
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} current="thread" />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" dir="auto">
            {thread.shortDisplayTitle ?? thread.subject ?? "Thread"}
          </h1>
          {thread.subject ? <p className="text-muted-foreground mt-1 text-sm">{thread.subject}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {thread.status ? <Badge>{thread.status}</Badge> : null}
          {thread.importance ? <Badge variant="secondary">{thread.importance}</Badge> : null}
          {thread.requiresAction ? <Badge variant="outline">action</Badge> : null}
          {thread.urgency ? <Badge variant="outline">{thread.urgency}</Badge> : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {thread.summary ? <p dir="auto">{thread.summary}</p> : <p className="text-muted-foreground">No analysis yet.</p>}
            {thread.actionSummary ? (
              <p>
                <span className="text-muted-foreground">What to do: </span>
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
              <p className="text-sm">Low classification confidence ({thread.confidence?.toFixed(2)}).</p>
            ) : null}
            <a href={thread.gmailUrl} target="_blank" rel="noreferrer" className="inline-block text-sm underline">
              Open in Gmail
            </a>
            {thread.actionId ? (
              <ActionControls actionId={thread.actionId} status={thread.actionStatus ?? "OPEN"} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {thread.messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No stored message metadata.</p>
            ) : (
              thread.messages.map((message) => (
                <div key={message.id} className="border-border/60 border-b pb-3 last:border-0 last:pb-0">
                  <p className="text-sm">
                    {message.direction} · {message.senderName ?? message.senderEmail ?? "Unknown"}
                  </p>
                  <p className="text-muted-foreground text-xs">{formatDateTime(message.receivedAt)}</p>
                  {message.snippet ? (
                    <p className="mt-1 text-sm" dir="auto">
                      {message.snippet}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <ThreadFeedback threadId={thread.id} />
      </main>
    </div>
  );
}
