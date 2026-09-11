import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActionControls } from "@/components/actions/action-controls";
import { AppChrome } from "@/components/layout/app-chrome";
import { ThreadFeedback } from "@/components/threads/thread-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LabeledField } from "@/components/ui/labeled-field";
import { MetaBadge } from "@/components/ui/meta-badge";
import { mailBucketForThread } from "@/lib/mail/buckets";
import { getSessionUser } from "@/lib/supabase/auth";
import { getThreadDetailForUser } from "@/lib/threads/queries";
import { classForDeadline, displayUrgencyForDeadline, formatDate, formatDateTime } from "@/lib/ui/format";
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
  const inbound = [...thread.messages].reverse().find((message) => message.direction.toLowerCase() === "inbound");
  const senderMessage = inbound ?? thread.messages[thread.messages.length - 1];
  const sender = senderMessage?.senderName ?? senderMessage?.senderEmail ?? null;
  const urgencyLabel = displayUrgencyForDeadline(thread.deadline, thread.urgency);
  const backTab = mailBucketForThread({ status: thread.status, actionStatus: thread.actionStatus });
  const doText = thread.actionSummary;
  const whyText =
    thread.actionReason && doText && thread.actionReason.trim() === doText.trim()
      ? null
      : thread.actionReason;

  return (
    <AppChrome user={user} current="thread" width="narrow">
      <div>
        <Link href={`/mail?tab=${backTab}`} className="text-muted-foreground hover:text-foreground text-sm hover:underline">
          ← Back to Mail
        </Link>
        <h1 className="text-foreground mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl" dir="auto">
          {thread.shortDisplayTitle ?? thread.subject ?? "Thread"}
        </h1>
        {thread.subject ? (
          <p className="text-muted-foreground mt-1 text-sm" dir="auto">
            {thread.subject}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {thread.status ? <MetaBadge kind="status" value={thread.status} /> : null}
        {thread.importance ? <MetaBadge kind="importance" value={thread.importance} /> : null}
        {urgencyLabel ? <MetaBadge kind="urgency" value={urgencyLabel} /> : null}
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
          <div className="space-y-1">
            {sender ? <LabeledField label="Sender">{sender}</LabeledField> : null}
            {thread.latestMessageAt ? (
              <LabeledField label="Date">{formatDateTime(thread.latestMessageAt)}</LabeledField>
            ) : null}
            {doText ? (
              <LabeledField label="Do" dir="auto">
                {doText}
              </LabeledField>
            ) : null}
            {thread.deadline ? (
              <LabeledField label="Due" valueClassName={classForDeadline(thread.deadline)}>
                {formatDate(thread.deadline)}
                {thread.deadlineText ? ` (${thread.deadlineText})` : ""}
              </LabeledField>
            ) : null}
            {whyText ? (
              <LabeledField label="Why" dir="auto">
                {whyText}
              </LabeledField>
            ) : null}
            {thread.waitingFor ? <LabeledField label="Waiting on">{thread.waitingFor}</LabeledField> : null}
          </div>
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
    </AppChrome>
  );
}
