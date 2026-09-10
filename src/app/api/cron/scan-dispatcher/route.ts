import { NextResponse } from "next/server";

import { isCronConfigured, isGeminiConfigured, isGmailConfigured } from "@/lib/config/env";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import { dispatchDueScans } from "@/lib/scans/dispatcher";

export const maxDuration = 800;

async function handle(request: Request) {
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

  const summary = await dispatchDueScans();
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
