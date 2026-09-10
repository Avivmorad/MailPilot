import { describe, expect, it } from "vitest";

import { authorizeCronRequest } from "@/lib/scans/cron-auth";

describe("authorizeCronRequest", () => {
  it("accepts the Vercel Bearer secret", () => {
    const headers = new Headers({ authorization: "Bearer cron-secret" });
    expect(authorizeCronRequest(headers, "cron-secret")).toBe(true);
  });

  it("accepts the x-cron-secret header", () => {
    const headers = new Headers({ "x-cron-secret": "cron-secret" });
    expect(authorizeCronRequest(headers, "cron-secret")).toBe(true);
  });

  it("rejects a missing or wrong secret", () => {
    expect(authorizeCronRequest(new Headers(), "cron-secret")).toBe(false);
    expect(authorizeCronRequest(new Headers({ authorization: "Bearer other" }), "cron-secret")).toBe(
      false,
    );
  });
});
