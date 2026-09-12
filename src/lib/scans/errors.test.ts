import { describe, expect, it } from "vitest";

import {
  isMissingScanSchemaError,
  isScanRunUniqueViolation,
  scanStoreFailure,
  scanUserMessage,
  SCAN_USER_MESSAGES,
} from "@/lib/scans/errors";

describe("isMissingScanSchemaError", () => {
  it("detects PostgREST missing-table messages", () => {
    expect(
      isMissingScanSchemaError(
        new Error(
          "Failed to load running scan: Could not find the table 'public.scan_runs' in the schema cache",
        ),
      ),
    ).toBe(true);
  });

  it("ignores unrelated scan failures", () => {
    expect(isMissingScanSchemaError(new Error("gmail list failed"))).toBe(false);
  });
});

describe("scanStoreFailure", () => {
  it("appends the database detail", () => {
    expect(
      scanStoreFailure("Failed to load running scan", "relation scan_runs does not exist").message,
    ).toContain("scan_runs");
  });
});

describe("isScanRunUniqueViolation", () => {
  it("detects Postgres unique_violation and the admission index name", () => {
    expect(isScanRunUniqueViolation({ code: "23505" })).toBe(true);
    expect(
      isScanRunUniqueViolation({
        message:
          'duplicate key value violates unique constraint "scan_runs_one_running_per_connection"',
      }),
    ).toBe(true);
    expect(isScanRunUniqueViolation({ code: "42501", message: "permission denied" })).toBe(false);
  });
});

describe("scanUserMessage", () => {
  it("never returns raw provider or thread-id payloads", () => {
    expect(scanUserMessage("reauth_required")).toBe(SCAN_USER_MESSAGES.reauth_required);
    expect(scanUserMessage("gmail_quota")).toBe(SCAN_USER_MESSAGES.gmail_quota);
    expect(scanUserMessage("scan_failed", "invalid_grant from googleapis.com")).toBe(
      SCAN_USER_MESSAGES.scan_failed,
    );
    expect(scanUserMessage("partial_thread_failures", "thread_failures:1:t1")).toBe(
      SCAN_USER_MESSAGES.partial_thread_failures,
    );
  });
});
