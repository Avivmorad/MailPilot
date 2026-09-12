import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/supabase/auth";
import { listRecentThreadsForUser } from "@/lib/threads/queries";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  try {
    const items = await listRecentThreadsForUser(user.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
