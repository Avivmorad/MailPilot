import { describe, expect, it } from "vitest";

import {
  emitProductEvent,
  resetProductEventSink,
  sanitizeProductEvent,
  setProductEventSink,
} from "@/lib/observability/events";

describe("product events", () => {
  it("drops secrets, bodies, and OAuth callback query strings", () => {
    const sanitized = sanitizeProductEvent({
      type: "gmail.connect_failed",
      refreshToken: "ya29.secret-value",
      encrypted_refresh_token: "v1:iv:tag:ciphertext",
      email_body: "Invoice attached with bank details",
      thread_text: "Please reply with the Q3 numbers",
      callbackUrl: "https://app.example/api/gmail/callback?code=4/0ASomething&state=abc",
      connectionId: "conn-1",
      errorCode: "token_exchange",
    });

    const json = JSON.stringify(sanitized);
    expect(json).not.toMatch(/ya29|v1:iv|Invoice attached|Q3 numbers|code=4\/0/i);
    expect(sanitized.connectionId).toBe("conn-1");
    expect(sanitized.errorCode).toBe("token_exchange");
    expect(sanitized.callbackUrl).toBeUndefined();
    expect(sanitized.refreshToken).toBeUndefined();
    expect(sanitized.email_body).toBeUndefined();
  });

  it("redacts bearer tokens and hex encryption keys in values", () => {
    const sanitized = sanitizeProductEvent({
      type: "scan.failed",
      scanId: "scan-1",
      note: "Bearer ya29.abcdefghijklmnopqrstuvwxyz",
      key: "a".repeat(64),
    });
    expect(sanitized.note).toBeUndefined();
    expect(sanitized.key).toBeUndefined();
    expect(sanitized.scanId).toBe("scan-1");
  });

  it("does not log arbitrary unapproved fields that can contain mail content", () => {
    const privateText = "PRIVATE_MAIL_BODY_AND_PROMPT_CANARY";
    const sanitized = sanitizeProductEvent({
      type: "scan.failed",
      scanId: "scan-1",
      subject: privateText,
      providerResponse: privateText,
      errorCode: "gmail_unavailable",
    });
    expect(JSON.stringify(sanitized)).not.toContain(privateText);
    expect(sanitized.scanId).toBe("scan-1");
    expect(sanitized.errorCode).toBe("gmail_unavailable");
    expect(
      sanitizeProductEvent({ type: "scan.failed", errorCode: `raw body ${privateText}` }).errorCode,
    ).toBe("[redacted]");
  });

  it("emits JSON that operators can use without private email content", () => {
    const lines: string[] = [];
    setProductEventSink((line) => {
      lines.push(line);
    });
    emitProductEvent({
      type: "scan.completed",
      scanId: "scan-1",
      status: "SUCCESS",
      threadsAnalyzed: 12,
      durationMs: 8400,
      errorCode: null,
    });
    resetProductEventSink();

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.type).toBe("scan.completed");
    expect(parsed.scanId).toBe("scan-1");
    expect(parsed.threadsAnalyzed).toBe(12);
    expect(typeof parsed.ts).toBe("string");
  });
});
