import { NextResponse } from "next/server";

import { getScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const { id } = await context.params;
  const scan = await getScanRunForUser(user.id, id);
  if (!scan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(scan);
}
