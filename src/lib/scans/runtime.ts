import { emitProductEvent } from "@/lib/observability/events";
import type { SentryScanTypeTag } from "@/lib/observability/sentry-privacy";
import { captureSafeException } from "@/lib/observability/sentry-report";
import { chainIfContinued } from "@/lib/scans/continue";

const inflight = new Map<string, Promise<void>>();

export type ScanRuntimeTags = {
  scanType?: SentryScanTypeTag;
  /** Distinct from scanId so a continue slice is not joined to the finishing slice. */
  jobKey?: string;
};

/**
 * Keep a scan promise alive after the HTTP response is sent (local Node and
 * `after()` / waitUntil on serverless).
 */
export function runScanInBackground(
  scanId: string,
  execute: () => Promise<unknown>,
  tags: ScanRuntimeTags = {},
): Promise<void> {
  const key = tags.jobKey ?? scanId;
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const promise = Promise.resolve()
    .then(() => execute())
    .then(async (value) => {
      inflight.delete(key);
      await chainIfContinued(value);
    })
    .catch((error: unknown) => {
      emitProductEvent({
        type: "scan.failed",
        scanId,
        errorCode: error instanceof Error ? error.name : "scan_failed",
      });
      captureSafeException(error, {
        route: "/api/scans",
        scan_type: tags.scanType ?? "manual",
      });
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}
