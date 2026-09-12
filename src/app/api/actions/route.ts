import { NextResponse } from "next/server";

import { listActionsForUser } from "@/lib/actions/queries";
import { isActionTab } from "@/lib/actions/sort";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  const status = new URL(request.url).searchParams.get("status") ?? "OPEN";
  if (!isActionTab(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  try {
    const items = await listActionsForUser(user.id, status);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
