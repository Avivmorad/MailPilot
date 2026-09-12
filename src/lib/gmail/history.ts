export interface HistoryMessageRef {
  id: string;
  threadId: string;
}

export type HistoryListResult =
  | { ok: true; refs: HistoryMessageRef[]; latestHistoryId: string | null }
  | { ok: false; stale: true };

export interface HistoryAddedRecord {
  messagesAdded?: Array<{
    message?: {
      id?: string | null;
      threadId?: string | null;
      labelIds?: string[] | null;
    } | null;
  } | null> | null;
}

const SKIP_LABELS = new Set(["SPAM", "TRASH"]);

export function isStaleHistoryError(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === 404 || status === 410) {
    return true;
  }
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("historyid") &&
    (message.includes("not found") || message.includes("no longer"))
  );
}

function httpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const record = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  if (typeof record.response?.status === "number") {
    return record.response.status;
  }
  if (typeof record.status === "number") {
    return record.status;
  }
  if (typeof record.code === "number") {
    return record.code;
  }
  if (record.code === "404" || record.code === "410") {
    return Number(record.code);
  }
  return null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "";
}

export function refsFromHistoryRecords(records: HistoryAddedRecord[]): HistoryMessageRef[] {
  const seen = new Set<string>();
  const refs: HistoryMessageRef[] = [];
  for (const record of records) {
    for (const added of record.messagesAdded ?? []) {
      const message = added?.message;
      const id = message?.id;
      const threadId = message?.threadId;
      if (!id || !threadId) {
        continue;
      }
      const labels = message.labelIds ?? [];
      if (labels.some((label) => SKIP_LABELS.has(label))) {
        continue;
      }
      const key = `${id}:${threadId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      refs.push({ id, threadId });
    }
  }
  return refs;
}
