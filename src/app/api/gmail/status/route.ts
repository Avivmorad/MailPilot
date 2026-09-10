import { NextResponse } from "next/server";

import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getGmailStatusForUser(user.id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Failed to load Gmail status" }, { status: 500 });
  }
}
