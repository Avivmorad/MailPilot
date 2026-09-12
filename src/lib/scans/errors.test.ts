import { describe, expect, it } from "vitest";

import {
  isMissingScanSchemaError,
  isScanRunUniqueViolation,
  scanStoreFailure,
} from "@/lib/scans/errors";

describe("isMissingScanSchemaError", () => {
  it("detects PostgREST missing-table messages", () => {
    expect(
      isMissingScanSchemaError(
        new Error("Failed to load running scan: Could not find the table 'public.scan_runs' in the schema cache"),
      ),
    ).toBe(true);
  });

  it("ignores unrelated scan failures", () => {
    expect(isMissingScanSchemaError(new Error("gmail list failed"))).toBe(false);
  });
});

describe("scanStoreFailure", () => {
  it("appends the database detail", () => {
    expect(scanStoreFailure("Failed to load running scan", "relation scan_runs does not exist").message).toContain(
      "scan_runs",
    );
  });
});

describe("isScanRunUniqueViolation", () => {
  it("detects Postgres unique_violation and the admission index name", () => {
    expect(isScanRunUniqueViolation({ code: "23505" })).toBe(true);
    expect(isScanRunUniqueViolation({ message: "duplicate key value violates unique constraint \"scan_runs_one_running_per_connection\"" })).toBe(true);
    expect(isScanRunUniqueViolation({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
