import type { gmail_v1 } from "googleapis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GmailDeadlineError } from "@/lib/gmail/request-budget";
import { resetSharedGmailQuotaForTests } from "@/lib/gmail/quota";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import type { ScanGmailPort } from "@/lib/scans/types";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  resetSharedGmailQuotaForTests();
});
afterEach(() => vi.useRealTimers());

describe("scan Gmail SDK budget propagation", () => {
  it.each([
    ["messages.list", (port: ScanGmailPort) => port.listMessageRefs("synthetic-query")],
    ["history.list", (port: ScanGmailPort) => port.listHistoryChanges("synthetic-history")],
    ["threads.get", (port: ScanGmailPort) => port.fetchThread("t1")],
    ["getProfile", (port: ScanGmailPort) => port.getProfileHistoryId()],
    ["sendAs.list", (port: ScanGmailPort) => port.listSendAsEmails!()],
    [
      "threads.modify",
      (port: ScanGmailPort) => port.modifyThreadLabels("t1", ["managed-label"], []),
    ],
  ] as const)("bounds %s and forwards its abort signal", async (_method, invoke) => {
    const request = vi.fn((params: unknown, options: unknown) => {
      void params;
      void options;
      return new Promise<never>(() => undefined);
    });
    const gmail = {
      users: {
        messages: { list: request },
        history: { list: request },
        threads: { get: request, modify: request },
        getProfile: request,
        settings: { sendAs: { list: request } },
      },
    } as unknown as gmail_v1.Gmail;
    const result = invoke(createGmailScanPort(gmail, "conn-1", { deadlineAt: 100 }));
    const assertion = expect(result).rejects.toBeInstanceOf(GmailDeadlineError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(request).toHaveBeenCalledTimes(1);
    const options = request.mock.calls[0]?.[1] as unknown as {
      timeout: number;
      retry: boolean;
      signal: AbortSignal;
    };
    expect(options).toMatchObject({ timeout: 100, retry: false });
    expect(options.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
