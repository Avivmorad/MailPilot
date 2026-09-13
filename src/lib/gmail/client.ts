import { google, type gmail_v1 } from "googleapis";

import { getGmailEnv, type GmailEnv } from "@/lib/config/env";
import { createOAuth2Client, GmailConnectError } from "@/lib/gmail/oauth";
import { SCAN_USER_MESSAGES } from "@/lib/scans/errors";
import { rotateSecretEnvelope } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

async function unwrapStoredRefreshToken(
  db: AdminClient,
  connectionId: string,
  ciphertext: string,
  env: GmailEnv,
): Promise<string> {
  let rotated: ReturnType<typeof rotateSecretEnvelope>;
  try {
    rotated = rotateSecretEnvelope(
      ciphertext,
      env.TOKEN_ENCRYPTION_KEY,
      env.TOKEN_ENCRYPTION_PREVIOUS_KEY,
    );
  } catch {
    throw new GmailConnectError("encryption_key", "Could not decrypt stored Gmail token");
  }

  if (rotated.rotatedCiphertext) {
    try {
      await db
        .from("gmail_connections")
        .update({ encrypted_refresh_token: rotated.rotatedCiphertext })
        .eq("id", connectionId);
    } catch {
      // Scan/connect still proceeds; ciphertext stays on the previous key.
    }
  }

  return rotated.plaintext;
}

export async function createGmailApi(refreshToken: string): Promise<gmail_v1.Gmail> {
  const auth = createOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  try {
    await auth.getAccessToken();
  } catch {
    throw new GmailConnectError("reauth_required", SCAN_USER_MESSAGES.reauth_required);
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
  const refreshToken = await unwrapStoredRefreshToken(
    db,
    data.id as string,
    data.encrypted_refresh_token as string,
    env,
  );

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

export async function createGmailApiForConnection(connectionId: string): Promise<{
  gmail: gmail_v1.Gmail;
  userId: string;
  gmailEmail: string;
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_connections")
    .select("id, user_id, gmail_email, encrypted_refresh_token, status")
    .eq("id", connectionId)
    .eq("status", "CONNECTED")
    .maybeSingle();

  if (error || !data?.encrypted_refresh_token) {
    throw new GmailConnectError("not_connected", "No connected Gmail account");
  }

  const env = getGmailEnv();
  const refreshToken = await unwrapStoredRefreshToken(
    db,
    data.id as string,
    data.encrypted_refresh_token as string,
    env,
  );

  try {
    const gmail = await createGmailApi(refreshToken);
    return { gmail, userId: data.user_id as string, gmailEmail: data.gmail_email as string };
  } catch (err) {
    if (err instanceof GmailConnectError && err.reason === "reauth_required") {
      await db.from("gmail_connections").update({ status: "REAUTH_REQUIRED" }).eq("id", data.id);
    }
    throw err;
  }
}
