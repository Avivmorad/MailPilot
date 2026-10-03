import Link from "next/link";

import { ActionControls } from "@/components/actions/action-controls";
import { MailCardTitle, MailOpenLink } from "@/components/mail/mail-card-chrome";
import { ThreadPlacementCorrection } from "@/components/threads/thread-placement-correction";
import { LabeledField } from "@/components/ui/labeled-field";
import { ThreadTags } from "@/components/ui/thread-tags";
import type { ActionListItem } from "@/lib/actions/action-list-item";
import { mailBucketForThread } from "@/lib/mail/buckets";
import { isUncertainClassification } from "@/lib/mail/filters";
import { displayDoLine, threadPlacementReason } from "@/lib/mail/placement";
import {
  classForDeadline,
  displayUrgencyForDeadline,
  formatDate,
  formatRelativeTime,
} from "@/lib/ui/format";
import { accentForUrgency } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export function ActionItemCard({
  item,
  categoryHref,
}: {
  item: ActionListItem;
  categoryHref?: string;
}) {
  const urgencyLabel = displayUrgencyForDeadline(item.deadline, item.urgency);
  const tab = mailBucketForThread({
    status: item.status === "WAITING" ? "waiting" : "action_required",
    actionStatus: item.status,
  });
  const doText = displayDoLine({
    tab,
    actionSummary: item.actionSummary,
    title: item.title,
    category: item.category,
    actionType: item.actionType,
    deadline: item.deadline,
    sender: item.sender,
    waitingFor: item.waitingFor,
    snoozedUntil: item.snoozedUntil,
  });
  const whyText =
    item.actionReason &&
    ((doText && item.actionReason.trim() === doText.trim()) ||
      item.actionReason.trim() === item.title.trim())
      ? null
      : item.actionReason;
  const placement = threadPlacementReason({
    tab,
    evidence: whyText,
    importanceReason: item.importanceReason,
    summary: item.summary,
    title: item.title,
    category: item.category,
    actionType: item.actionType,
    deadline: item.deadline,
    sender: item.sender,
    waitingFor: item.waitingFor,
    snoozedUntil: item.snoozedUntil,
  });
  const href = `/thread/${item.threadId}`;
  const when = item.latestMessageAt ? formatRelativeTime(item.latestMessageAt) : null;

  return (
    <article
      className={cn(
        "bg-card ring-foreground/10 min-w-0 overflow-hidden rounded-xl border-l-4 p-4 shadow-xs ring-1 sm:p-5",
        accentForUrgency(urgencyLabel ?? item.urgency),
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ThreadTags
            category={item.category}
            importance={item.importance}
            urgency={item.urgency}
            deadline={item.deadline}
            actionType={item.actionType}
            showStatus={false}
            categoryHref={categoryHref}
          />
          {isUncertainClassification(item.confidence) ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Uncertain</p>
          ) : null}
        </div>
        {when ? (
          <span className="text-muted-foreground shrink-0 pt-1 text-xs tabular-nums">{when}</span>
        ) : null}
      </div>
      <MailCardTitle title={item.title} className="mt-2">
        <Link href={href} className="hover:underline">
          {item.title}
        </Link>
      </MailCardTitle>
      {item.sender ? (
        <p
          className="text-muted-foreground mt-0.5 text-start text-sm [overflow-wrap:anywhere] break-words"
          dir="auto"
        >
          {item.sender}
        </p>
      ) : null}

      <div className="mt-3 min-w-0 space-y-1 overflow-hidden">
        {doText ? (
          <LabeledField label="Do" dir="auto">
            {doText}
          </LabeledField>
        ) : null}
        {item.deadline ? (
          <LabeledField label="Due" valueClassName={classForDeadline(item.deadline)}>
            {formatDate(item.deadline)}
          </LabeledField>
        ) : null}
        <LabeledField label="Why this tab" dir="auto">
          {placement}
        </LabeledField>
        {item.waitingFor ? <LabeledField label="Pending on">{item.waitingFor}</LabeledField> : null}
      </div>

      <div className="mt-3 space-y-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <MailOpenLink href={href} />
          <ActionControls
            key={`${item.id}:${item.status}:${item.waitingFor ?? ""}`}
            actionId={item.id}
            status={item.status}
            waitingFor={item.waitingFor}
            snoozedUntil={item.snoozedUntil}
          />
          <a
            href={item.gmailUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
            aria-label="Open in Gmail"
          >
            Open in Gmail
          </a>
        </div>
        <ThreadPlacementCorrection threadId={item.threadId} tab={tab} />
      </div>
    </article>
  );
}
