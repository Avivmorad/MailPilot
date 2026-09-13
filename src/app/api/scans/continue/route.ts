import { after } from "next/server";
import { NextResponse } from "next/server";

import { isCronConfigured, isGeminiConfigured, isGmailConfigured } from "@/lib/config/env";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import { continueScanRequestSchema, continueScanRun } from "@/lib/scans/continue";
import { runScanInBackground } from "@/lib/scans/runtime";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isCronConfigured()) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  const secret = process.env.CRON_SECRET ?? "";
  if (!authorizeCronRequest(request.headers, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isGmailConfigured() || !isGeminiConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const json: unknown = await request.json().catch(() => ({}));
  const parsed = continueScanRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_scan" }, { status: 400 });
  }

  const running = runScanInBackground(
    parsed.data.scanId,
    () => continueScanRun(parsed.data.scanId),
    {
      scanType: "manual",
    },
  );
  after(async () => {
    await running;
  });
  return NextResponse.json({ scanId: parsed.data.scanId, status: "RUNNING" }, { status: 202 });
}
