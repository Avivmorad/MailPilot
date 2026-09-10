import { NextResponse } from "next/server";

import { disconnectGmailForUser } from "@/lib/gmail/connections";
import { getSessionUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin), { status: 303 });
  }

  try {
    await disconnectGmailForUser(user.id);
  } catch {
    const url = new URL("/dashboard", origin);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("reason", "disconnect_failed");
    return NextResponse.redirect(url, { status: 303 });
  }

  const url = new URL("/dashboard", origin);
  url.searchParams.set("gmail", "disconnected");
  return NextResponse.redirect(url, { status: 303 });
}
