import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GMAIL_REQUEST_TIMEOUT_MS,
  GmailDeadlineError,
  GmailRequestTimeoutError,
  waitForGmailBudget,
  withGmailRequest,
} from "@/lib/gmail/request-budget";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Gmail request budget", () => {
  it("does not start work after the deadline", async () => {
    const operation = vi.fn(async () => "ok");
    await expect(withGmailRequest(operation, { deadlineAt: 0 })).rejects.toBeInstanceOf(
      GmailDeadlineError,
    );
    expect(operation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a hung request and passes cancellation into the SDK", async () => {
    let signal: AbortSignal | undefined;
    const operation = vi.fn((options: { signal: AbortSignal; timeout: number; retry: false }) => {
      signal = options.signal;
      return new Promise<never>(() => undefined);
    });
    const result = withGmailRequest(operation, { deadlineAt: 100 });
    const assertion = expect(result).rejects.toBeInstanceOf(GmailDeadlineError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(operation).toHaveBeenCalledWith(expect.objectContaining({ timeout: 100, retry: false }));
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distinguishes a per-request timeout from exhausting the slice", async () => {
    const result = withGmailRequest(() => new Promise<never>(() => undefined), {
      deadlineAt: 210_000,
    });
    const assertion = expect(result).rejects.toBeInstanceOf(GmailRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(GMAIL_REQUEST_TIMEOUT_MS);
    await assertion;
    expect(Date.now()).toBe(30_000);
  });

  it("cancels in-flight work and removes listeners/timers", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = withGmailRequest(() => new Promise<never>(() => undefined), {
      signal: controller.signal,
    });
    const error = new Error("synthetic cancellation");
    const assertion = expect(result).rejects.toBe(error);
    controller.abort(error);
    await assertion;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not admit work after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn(async () => "ok");
    await expect(withGmailRequest(operation, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("clears the request timer on success and synchronous throw", async () => {
    await expect(withGmailRequest(async () => "ok")).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      withGmailRequest(() => {
        throw new Error("synthetic failure");
      }),
    ).rejects.toThrow("synthetic failure");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses a wait that would consume remaining checkpoint headroom", async () => {
    const sleep = vi.fn(async () => undefined);
    await expect(waitForGmailBudget(60_000, { deadlineAt: 59_999 }, sleep)).rejects.toBeInstanceOf(
      GmailDeadlineError,
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("cancels quota/retry sleep promptly without leaving a timer", async () => {
    const controller = new AbortController();
    const result = waitForGmailBudget(60_000, { signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
