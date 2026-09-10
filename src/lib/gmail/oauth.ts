import { randomBytes } from "node:crypto";

import { google } from "googleapis";

import { getGmailEnv } from "@/lib/config/env";
import { GMAIL_MODIFY_SCOPE } from "@/lib/gmail/constants";
import { timingSafeStringEqual } from "@/lib/security/encryption";

export function createOAuth2Client() {
  const env = getGmailEnv();
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

export function createOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function buildConsentUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [GMAIL_MODIFY_SCOPE],
    state,
  });
}

export function isValidOAuthState(expected: string | undefined, received: string | undefined): boolean {
  if (!expected || !received) {
    return false;
  }
  return timingSafeStringEqual(expected, received);
}

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken: string;
  expiryDate: number | null;
}

export async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenSet> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google token exchange returned no access token");
  }
  if (!tokens.refresh_token) {
    throw new Error("NO_REFRESH_TOKEN");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ?? null,
  };
}

export async function fetchGmailIdentity(
  accessToken: string,
  refreshToken: string,
): Promise<{ email: string; googleAccountId: string | null }> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;
  if (!email) {
    throw new Error("Gmail profile did not include an email address");
  }

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const info = await oauth2.userinfo.get();

  return {
    email,
    googleAccountId: info.data.id ?? null,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const client = createOAuth2Client();
  await client.revokeToken(refreshToken);
}
