import { emitProductEvent } from "@/lib/observability/events";
import type { SentryScanTypeTag } from "@/lib/observability/sentry-privacy";
import { captureSafeException } from "@/lib/observability/sentry-report";

const inflight = new Map<string, Promise<void>>();

export type ScanRuntimeTags = {
  scanType?: SentryScanTypeTag;
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
  const existing = inflight.get(scanId);
  if (existing) {
    return existing;
  }
  const promise = Promise.resolve()
    .then(() => execute())
    .then(() => undefined)
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
      inflight.delete(scanId);
    });
  inflight.set(scanId, promise);
  return promise;
}
