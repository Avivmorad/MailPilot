import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LabeledField } from "@/components/ui/labeled-field";
import { MetaBadge } from "@/components/ui/meta-badge";
import type { DigestReport } from "@/lib/digest/types";
import { classForDeadline, displayUrgencyForDeadline, formatDate, formatDateTime } from "@/lib/ui/format";

function DigestCounts({ digest }: { digest: DigestReport }) {
  const stats = [
    { label: "Processed", value: digest.totalMessages },
    { label: "Important", value: digest.importantCount },
    { label: "Open", value: digest.actionCount },
    { label: "Waiting", value: digest.waitingCount },
    { label: "FYI", value: digest.informationalCount },
    { label: "Ignored", value: digest.ignoredCount },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-muted-foreground text-xs">{stat.label}</dt>
          <dd className="text-foreground text-xl font-semibold tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DigestReportCard({
  digest,
  title = "Latest digest",
  variant = "full",
}: {
  digest: DigestReport | null;
  title?: string;
  variant?: "full" | "compact";
}) {
  if (variant === "compact") {
    if (!digest) {
      return (
        <p className="text-muted-foreground text-sm">
          No digest yet. After a scan, period counts and top open tasks will appear here.{" "}
          <Link href="/digests" className="text-primary font-medium hover:underline">
            Digest history
          </Link>
        </p>
      );
    }
    const preview = digest.topActions.slice(0, 3);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latest digest</CardTitle>
          <CardDescription>
            {formatDateTime(digest.periodStart)} – {formatDateTime(digest.periodEnd)}
            {digest.actionCount > 0 ? ` · ${digest.actionCount} open` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {digest.summaryText ? (
            <p className="text-sm leading-relaxed text-pretty line-clamp-3">{digest.summaryText}</p>
          ) : null}
          {preview.length > 0 ? (
            <ul className="divide-border divide-y text-sm">
              {preview.map((action) => (
                <li key={action.threadId} className="py-2 first:pt-0 last:pb-0">
                  <Link href={`/thread/${action.threadId}`} className="hover:text-primary font-medium hover:underline">
                    {action.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No open tasks in this digest.</p>
          )}
          <Link href="/digests" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Full digest
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!digest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Period counts and top open tasks after a scan.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No digest yet"
            description="Run a scan to generate an in-app digest. Counts come from mail already stored in MailPilot."
            action={
              <Link href="/dashboard#scan" className={buttonVariants({ size: "sm" })}>
                Scan now
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {formatDateTime(digest.periodStart)} – {formatDateTime(digest.periodEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {digest.summaryText ? <p className="text-sm leading-relaxed">{digest.summaryText}</p> : null}
        <DigestCounts digest={digest} />
        {digest.topActions.length > 0 ? (
          <div>
            <h3 className="text-foreground mb-2 text-sm font-semibold">Top open tasks</h3>
            <ul className="divide-border divide-y">
              {digest.topActions.map((action) => {
                const urgencyLabel = displayUrgencyForDeadline(action.deadline, action.urgency);
                return (
                  <li key={action.threadId} className="py-2 first:pt-0 last:pb-0">
                    <Link
                      href={`/thread/${action.threadId}`}
                      className="hover:text-primary block font-medium hover:underline"
                    >
                      {action.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {urgencyLabel ? <MetaBadge kind="urgency" value={urgencyLabel} /> : null}
                      {action.deadline ? (
                        <LabeledField label="Due" valueClassName={classForDeadline(action.deadline)}>
                          {formatDate(action.deadline)}
                        </LabeledField>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No open tasks in this digest.</p>
        )}
      </CardContent>
    </Card>
  );
}
