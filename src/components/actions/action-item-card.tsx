import Link from "next/link";

import { ActionControls } from "@/components/actions/action-controls";
import { ThreadPlacementCorrection } from "@/components/threads/thread-placement-correction";
import { LabeledField } from "@/components/ui/labeled-field";
import { ThreadTags } from "@/components/ui/thread-tags";
import type { ActionListItem } from "@/lib/actions/queries";
import { mailBucketForThread } from "@/lib/mail/buckets";
import { isUncertainClassification } from "@/lib/mail/filters";
import { threadPlacementReason } from "@/lib/mail/placement";
import {
  classForDeadline,
  displayUrgencyForDeadline,
  formatDate,
  formatRelativeTime,
} from "@/lib/ui/format";
import { accentForUrgency } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export function ActionItemCard({ item }: { item: ActionListItem }) {
  const urgencyLabel = displayUrgencyForDeadline(item.deadline, item.urgency);
  const doText =
    item.actionSummary && item.actionSummary.trim() === item.title.trim()
      ? null
      : item.actionSummary;
  const whyText =
    item.actionReason &&
    ((doText && item.actionReason.trim() === doText.trim()) ||
      item.actionReason.trim() === item.title.trim())
      ? null
      : item.actionReason;
  const tab = mailBucketForThread({
    status: item.status === "WAITING" ? "waiting" : "action_required",
    actionStatus: item.status,
  });
  const placement = threadPlacementReason({ tab, evidence: whyText });
  const meta = [item.sender, item.latestMessageAt ? formatRelativeTime(item.latestMessageAt) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "bg-card ring-foreground/10 rounded-xl border-l-4 p-4 shadow-xs ring-1 sm:p-5",
        accentForUrgency(urgencyLabel ?? item.urgency),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="text-foreground text-base leading-snug font-semibold tracking-tight break-words"
            dir="auto"
          >
            <Link href={`/thread/${item.threadId}`} className="hover:underline" title={item.title}>
              {item.title}
            </Link>
          </h3>
          {meta ? (
            <p className="text-muted-foreground mt-0.5 text-sm break-words" dir="auto">
              {meta}
            </p>
          ) : null}
        </div>
        <div className="flex max-w-full min-w-0 shrink justify-end sm:max-w-[min(100%,20rem)]">
          <ThreadTags
            category={item.category}
            importance={item.importance}
            urgency={item.urgency}
            deadline={item.deadline}
            actionType={item.actionType}
            showStatus={false}
          />
          {isUncertainClassification(item.confidence) ? (
            <p className="mt-1 text-right text-xs text-amber-800 dark:text-amber-200">Uncertain</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1">
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
        {item.waitingFor ? <LabeledField label="Waiting on">{item.waitingFor}</LabeledField> : null}
      </div>

      <div className="mt-3 space-y-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-3">
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
