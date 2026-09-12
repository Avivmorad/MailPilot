import { describe, expect, it } from "vitest";

import {
  isMissingScanSchemaError,
  SCAN_SCHEMA_MISSING_MESSAGE,
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

describe("SCAN_SCHEMA_MISSING_MESSAGE", () => {
  it("points operators at the full migration series", () => {
    expect(SCAN_SCHEMA_MISSING_MESSAGE).toContain("0009_function_hardening.sql");
  });
});
