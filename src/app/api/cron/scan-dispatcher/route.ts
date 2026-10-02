import { after } from "next/server";
import { NextResponse } from "next/server";

import { isCronConfigured, isGmailConfigured, isTriageConfigured } from "@/lib/config/env";
import { captureSafeException } from "@/lib/observability/sentry-report";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import { parseDispatchSlice, runDispatchCycle } from "@/lib/scans/dispatcher";

export const maxDuration = 300;

async function handle(request: Request) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const secret = process.env.CRON_SECRET ?? "";
  if (!authorizeCronRequest(request.headers, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isGmailConfigured() || !isTriageConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const parsed = await parseDispatchSlice(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_slice" }, { status: 400 });
  }

  const cycle = runDispatchCycle({ slice: parsed.slice });
  if (request.method === "GET") {
    try {
      const summary = await cycle;
      return NextResponse.json(summary);
    } catch (error) {
      captureSafeException(error, {
        route: "/api/cron/scan-dispatcher",
        scan_type: "scheduled",
      });
      return NextResponse.json({ error: "dispatch_failed" }, { status: 500 });
    }
  }

  // Chained slices must acknowledge before the caller's short timeout.
  // The scan itself keeps running after this response.
  after(async () => {
    try {
      await cycle;
    } catch (error) {
      captureSafeException(error, {
        route: "/api/cron/scan-dispatcher",
        scan_type: "scheduled",
      });
    }
  });
  return NextResponse.json({ accepted: true, slice: parsed.slice }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
