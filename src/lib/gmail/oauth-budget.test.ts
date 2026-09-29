import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  getGmailEnv: () => ({
    GOOGLE_CLIENT_ID: "synthetic-client",
    GOOGLE_CLIENT_SECRET: "synthetic-secret",
    GOOGLE_REDIRECT_URI: "https://example.test/callback",
  }),
}));

import { createOAuth2Client, withGmailOAuthRequest } from "@/lib/gmail/oauth";
import { GMAIL_REQUEST_TIMEOUT_MS, GmailDeadlineError } from "@/lib/gmail/request-budget";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

describe("OAuth transporter request budget", () => {
  it("sets a finite default for token requests", () => {
    expect(createOAuth2Client().transporter.defaults.timeout).toBe(GMAIL_REQUEST_TIMEOUT_MS);
  });

  it("forwards the deadline signal and restores the transporter after a hung token request", async () => {
    const client = createOAuth2Client();
    const previous = new AbortController().signal;
    client.transporter.defaults.signal = previous;
    let active: AbortSignal | undefined;
    const operation = vi.fn(() => {
      active = client.transporter.defaults.signal ?? undefined;
      expect(client.transporter.defaults.timeout).toBe(100);
      return new Promise<never>(() => undefined);
    });
    const assertion = expect(
      withGmailOAuthRequest(client, operation, { deadlineAt: 100 }),
    ).rejects.toBeInstanceOf(GmailDeadlineError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(operation).toHaveBeenCalledTimes(1);
    expect(active?.aborted).toBe(true);
    expect(client.transporter.defaults.signal).toBe(previous);
    expect(client.transporter.defaults.timeout).toBe(GMAIL_REQUEST_TIMEOUT_MS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])("restores options after a settled request (failure: %s)", async (fail) => {
    const client = createOAuth2Client();
    const previous = client.transporter.defaults.signal;
    const operation = async () => {
      expect(client.transporter.defaults.signal).toBeInstanceOf(AbortSignal);
      if (fail) throw new Error("synthetic error");
      return "synthetic result";
    };
    const result = withGmailOAuthRequest(client, operation, { deadlineAt: 100 });
    if (fail) await expect(result).rejects.toThrow("synthetic error");
    else await expect(result).resolves.toBe("synthetic result");
    expect(client.transporter.defaults.signal).toBe(previous);
    expect(client.transporter.defaults.timeout).toBe(GMAIL_REQUEST_TIMEOUT_MS);
    expect(vi.getTimerCount()).toBe(0);
  });
});
