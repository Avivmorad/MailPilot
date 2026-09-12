import { emitProductEvent } from "@/lib/observability/events";

const inflight = new Map<string, Promise<void>>();

/**
 * Keep a scan promise alive after the HTTP response is sent (local Node and
 * `after()` / waitUntil on serverless).
 */
export function runScanInBackground(
  scanId: string,
  execute: () => Promise<unknown>,
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
    })
    .finally(() => {
      inflight.delete(scanId);
    });
  inflight.set(scanId, promise);
  return promise;
}
