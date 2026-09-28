import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isGmailConfigured } from "@/lib/config/env";
import { safeAppReturnPath } from "@/lib/auth/redirects";
import { GMAIL_OAUTH_RETURN_COOKIE, GMAIL_OAUTH_STATE_COOKIE } from "@/lib/gmail/constants";
import { buildConsentUrl, createOAuthState } from "@/lib/gmail/oauth";
import { getSessionUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const returnTo = safeAppReturnPath(
    requestUrl.searchParams.get("returnTo") ?? requestUrl.searchParams.get("redirectedFrom"),
    "/onboarding",
  );
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?redirectedFrom=${encodeURIComponent(returnTo)}`, origin),
    );
  }

  if (!isGmailConfigured()) {
    const url = new URL(returnTo, origin);
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
  cookieStore.set(GMAIL_OAUTH_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return NextResponse.redirect(buildConsentUrl(state));
}
