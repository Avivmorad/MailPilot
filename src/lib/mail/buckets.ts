import { z } from "zod";

import type { ActionStatus } from "@/lib/actions/reconcile-action";
import { THREAD_STATUS_VALUES, type ThreadStatus } from "@/lib/ai/schemas";
import type { MailTab } from "@/lib/mail/tabs";

const threadStatusSet = new Set<string>(THREAD_STATUS_VALUES);

export function normalizeThreadStatus(status: string | null | undefined): ThreadStatus {
  if (status && threadStatusSet.has(status)) {
    return status as ThreadStatus;
  }
  return "informational";
}

/**
 * One canonical Mail tab for a thread. Action workflow can refine Open
 * into waiting / completed / snoozed; ignore and summary never share a thread.
 */
export function mailBucketForThread(input: {
  status: string | null | undefined;
  actionStatus?: ActionStatus | string | null;
}): MailTab {
  const status = normalizeThreadStatus(input.status);
  if (status === "ignore") {
    return "ignored";
  }
  if (status === "waiting") {
    return "waiting";
  }
  if (status === "action_required") {
    if (input.actionStatus === "COMPLETED") {
      return "completed";
    }
    if (input.actionStatus === "SNOOZED") {
      return "snoozed";
    }
    if (input.actionStatus === "WAITING") {
      return "waiting";
    }
    return "open";
  }
  return "summary";
}

const exclusiveGroupsSchema = z
  .array(z.object({ id: z.string().min(1), bucket: z.string() }))
  .superRefine((rows, ctx) => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const previous = seen.get(row.id);
      if (previous && previous !== row.bucket) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `thread ${row.id} cannot be in both ${previous} and ${row.bucket}`,
        });
      }
      seen.set(row.id, row.bucket);
    }
  });

export function assertExclusiveMailBuckets(
  rows: Array<{ id: string; bucket: MailTab | string }>,
): void {
  const parsed = exclusiveGroupsSchema.safeParse(rows);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "thread appears in multiple mail groups");
  }
}
