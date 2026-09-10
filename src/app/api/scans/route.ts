import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/supabase/auth";
import { manualScanRequestSchema, ScanRequestError, startManualInitialScan } from "@/lib/scans/manual";

export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let json: unknown = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    json = await request.json().catch(() => ({}));
  }

  const parsed = manualScanRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_lookback" }, { status: 400 });
  }

  try {
    const result = await startManualInitialScan(user.id, parsed.data.lookbackDays);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScanRequestError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Scan failed.";
    return NextResponse.json({ error: "scan_failed", message }, { status: 500 });
  }
}
