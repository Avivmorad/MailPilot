import { describe, expect, it } from "vitest";

import type { Event } from "@sentry/nextjs";

import {
  pickAllowedSentryTags,
  redactSensitiveText,
  sanitizeSentryEvent,
  sanitizeSentryRoute,
  sentryEnvironment,
  sentryErrorCategoryFromError,
  sentryProviderFromError,
  sentryScanType,
} from "@/lib/observability/sentry-privacy";

describe("sentry privacy", () => {
  it("maps scan triggers and classifies non-sensitive error categories", () => {
    expect(sentryScanType("INITIAL")).toBe("initial");
    expect(sentryScanType("MANUAL")).toBe("manual");
    expect(sentryScanType("RECOVERY")).toBe("recovery");
    expect(sentryScanType("SCHEDULED")).toBe("scheduled");
    expect(sentryErrorCategoryFromError(new Error("reauth_required"))).toBe("reauth");
    expect(sentryErrorCategoryFromError(new Error("gmail_quota"))).toBe("quota");
    expect(sentryErrorCategoryFromError(new Error("ai_unavailable"))).toBe("ai");
    expect(sentryErrorCategoryFromError(new Error("thread_failures:abc"))).toBe("partial");
    expect(sentryProviderFromError(new Error("googleapis quota"))).toBe("gmail");
    expect(sentryProviderFromError(new Error("gemini overloaded"))).toBe("gemini");
  });

  it("normalizes routes and redacts email and token material", () => {
    expect(
      sanitizeSentryRoute(
        "https://app.example/thread/11111111-2222-4333-a444-555555555555?code=secret",
      ),
    ).toBe("/thread/[id]");
    expect(redactSensitiveText("user ada@example.com token ya29.abcDEF-_")).toBe(
      "user [email] token [redacted]",
    );
    expect(redactSensitiveText(`key ${"ab".repeat(32)}`)).toBe("key [redacted]");
  });

  it("keeps only the allowed tags and strips mail, users, extras, and request bodies", () => {
    const event = {
      message: "Failed for ada@example.com with Bearer secret-token-value",
      user: { email: "ada@example.com", ip_address: "203.0.113.9" },
      extra: { body: "Please pay invoice 42", accessToken: "ya29.abc" },
      tags: {
        environment: "preview",
        route: "/mail",
        provider: "gmail",
        scan_type: "manual",
        error_category: "quota",
        userId: "should-drop",
        gmailEmail: "ada@example.com",
      },
      request: {
        method: "POST",
        url: "https://app.example/api/scans?token=abc",
        data: { lookbackDays: 7, snippet: "OTP 123456" },
        cookies: { sb: "session" },
        headers: { authorization: "Bearer cron-secret" },
        query_string: "token=abc",
      },
      breadcrumbs: [
        {
          message: "Scanned ada@example.com",
          data: { threadText: "bank details" },
          category: "scan",
        },
      ],
      exception: {
        values: [{ type: "Error", value: "invalid_grant for ada@example.com" }],
      },
    } as Event;

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized).not.toBeNull();
    const json = JSON.stringify(sanitized);
    expect(json).not.toMatch(
      /ada@example\.com|OTP 123456|bank details|cron-secret|ya29|203\.0\.113|should-drop/i,
    );
    expect(sanitized?.user).toBeUndefined();
    expect(sanitized?.extra).toBeUndefined();
    expect(sanitized?.request?.data).toBeUndefined();
    expect(sanitized?.request?.headers).toBeUndefined();
    expect(sanitized?.tags).toEqual({
      environment: "preview",
      route: "/mail",
      provider: "gmail",
      scan_type: "manual",
      error_category: "quota",
    });
    expect(sanitized?.exception?.values?.[0]?.value).toBe("invalid_grant for [email]");
  });

  it("drops replay and feedback events", () => {
    expect(sanitizeSentryEvent({ type: "replay_event" } as Event)).toBeNull();
    expect(sanitizeSentryEvent({ type: "feedback" } as Event)).toBeNull();
  });

  it("fills environment from Vercel when no tag is present", () => {
    expect(sentryEnvironment({ NEXT_PUBLIC_VERCEL_ENV: "preview" })).toBe("preview");
    expect(pickAllowedSentryTags({ environment: "", route: undefined })).toEqual({});
  });
});
