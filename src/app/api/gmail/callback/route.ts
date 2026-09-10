import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { completeGmailOAuth, gmailCallbackErrorRedirect } from "@/lib/gmail/connections";
import { GMAIL_OAUTH_STATE_COOKIE } from "@/lib/gmail/constants";
import { GmailConnectError, isValidOAuthState } from "@/lib/gmail/oauth";
import { getSessionUser } from "@/lib/supabase/auth";

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const parsed = callbackQuerySchema.safeParse({
    code: requestUrl.searchParams.get("code") ?? undefined,
    state: requestUrl.searchParams.get("state") ?? undefined,
    error: requestUrl.searchParams.get("error") ?? undefined,
  });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GMAIL_OAUTH_STATE_COOKIE);

  if (!parsed.success) {
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "invalid_request"));
  }

  const { code, state, error } = parsed.data;
  if (error) {
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "denied"));
  }

  if (!isValidOAuthState(expectedState, state)) {
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "invalid_state"));
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "not_signed_in"));
  }

  if (!code) {
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "missing_code"));
  }

  try {
    await completeGmailOAuth(user.id, code);
  } catch (err) {
    if (err instanceof GmailConnectError) {
      return NextResponse.redirect(gmailCallbackErrorRedirect(origin, err.reason));
    }
    const message = err instanceof Error ? err.message : "";
    if (message === "NO_REFRESH_TOKEN") {
      return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "no_refresh_token"));
    }
    return NextResponse.redirect(gmailCallbackErrorRedirect(origin, "connect_failed"));
  }

  const success = new URL("/dashboard", origin);
  success.searchParams.set("gmail", "connected");
  return NextResponse.redirect(success);
}
