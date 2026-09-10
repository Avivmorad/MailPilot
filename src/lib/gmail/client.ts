import { google, type gmail_v1 } from "googleapis";

import { getGmailEnv } from "@/lib/config/env";
import { createOAuth2Client, GmailConnectError } from "@/lib/gmail/oauth";
import { decryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createGmailApi(refreshToken: string): Promise<gmail_v1.Gmail> {
  const auth = createOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  try {
    await auth.getAccessToken();
  } catch {
    throw new GmailConnectError("reauth_required", "Gmail access token refresh failed");
  }
  return google.gmail({ version: "v1", auth });
}

/**
 * Build a Gmail API client from the user's stored encrypted refresh token.
 */
export async function createGmailApiForUser(userId: string): Promise<{
  gmail: gmail_v1.Gmail;
  connectionId: string;
  gmailEmail: string;
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_connections")
    .select("id, gmail_email, encrypted_refresh_token, status")
    .eq("user_id", userId)
    .eq("status", "CONNECTED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.encrypted_refresh_token) {
    throw new GmailConnectError("not_connected", "No connected Gmail account");
  }

  const env = getGmailEnv();
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(data.encrypted_refresh_token, env.TOKEN_ENCRYPTION_KEY);
  } catch {
    throw new GmailConnectError("encryption_key", "Could not decrypt stored Gmail token");
  }

  try {
    const gmail = await createGmailApi(refreshToken);
    return { gmail, connectionId: data.id as string, gmailEmail: data.gmail_email as string };
  } catch (err) {
    if (err instanceof GmailConnectError && err.reason === "reauth_required") {
      await db.from("gmail_connections").update({ status: "REAUTH_REQUIRED" }).eq("id", data.id);
    }
    throw err;
  }
}
