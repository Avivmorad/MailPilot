import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isGmailConfigured } from "@/lib/config/env";
import { GMAIL_OAUTH_STATE_COOKIE } from "@/lib/gmail/constants";
import { buildConsentUrl, createOAuthState } from "@/lib/gmail/oauth";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?redirectedFrom=/dashboard", origin));
  }

  if (!isGmailConfigured()) {
    const url = new URL("/dashboard", origin);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(url);
  }

  const state = createOAuthState();
  const cookieStore = await cookies();
  cookieStore.set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return NextResponse.redirect(buildConsentUrl(state));
}
