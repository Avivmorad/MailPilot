import { NextResponse } from "next/server";

import { cancelScanForUser, cancelScanParamsSchema } from "@/lib/scans/cancel";
import { ScanRequestError } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = cancelScanParamsSchema.safeParse({ scanId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_scan" }, { status: 400 });
  }

  try {
    const result = await cancelScanForUser(user.id, parsed.data.scanId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScanRequestError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "scan_failed", message: "Could not cancel the scan." },
      { status: 500 },
    );
  }
}
