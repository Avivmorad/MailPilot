import { getGmailEnv, isGmailConfigured } from "@/lib/config/env";
import {
  type GmailConnectionPublic,
  type GmailConnectionStatus,
  type GmailStatusPayload,
} from "@/lib/gmail/constants";
import { ensureManagedLabels } from "@/lib/gmail/labels";
import {
  exchangeAuthorizationCode,
  fetchGmailIdentity,
  revokeRefreshToken,
} from "@/lib/gmail/oauth";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

interface ConnectionRow {
  id: string;
  user_id: string;
  gmail_email: string;
  google_account_id: string | null;
  encrypted_refresh_token?: string | null;
  status: GmailConnectionStatus;
  last_successful_scan_at: string | null;
  next_scan_at: string | null;
}

export function toPublicConnection(row: ConnectionRow): GmailConnectionPublic {
  return {
    id: row.id,
    gmailEmail: row.gmail_email,
    status: row.status,
    lastSuccessfulScanAt: row.last_successful_scan_at,
    nextScanAt: row.next_scan_at,
  };
}

export async function getGmailStatusForUser(userId: string): Promise<GmailStatusPayload> {
  const configured = isGmailConfigured();
  if (!configured) {
    return { configured: false, connection: null };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_connections")
    .select("id, user_id, gmail_email, google_account_id, status, last_successful_scan_at, next_scan_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load Gmail connection status");
  }

  return {
    configured: true,
    connection: data ? toPublicConnection(data as ConnectionRow) : null,
  };
}

export async function completeGmailOAuth(userId: string, code: string): Promise<GmailConnectionPublic> {
  const env = getGmailEnv();
  const tokens = await exchangeAuthorizationCode(code);
  const identity = await fetchGmailIdentity(tokens.accessToken, tokens.refreshToken);
  const encryptedRefreshToken = encryptSecret(tokens.refreshToken, env.TOKEN_ENCRYPTION_KEY);

  const db = createAdminClient();
  const { error: profileError } = await db.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  if (profileError) {
    throw new Error("Failed to persist Gmail connection");
  }

  const { data, error } = await db
    .from("gmail_connections")
    .upsert(
      {
        user_id: userId,
        gmail_email: identity.email,
        google_account_id: identity.googleAccountId,
        encrypted_refresh_token: encryptedRefreshToken,
        status: "CONNECTED",
      },
      { onConflict: "user_id,gmail_email" },
    )
    .select("id, user_id, gmail_email, google_account_id, status, last_successful_scan_at, next_scan_at")
    .single();

  if (error || !data) {
    throw new Error("Failed to persist Gmail connection");
  }

  const row = data as ConnectionRow;

  try {
    await ensureManagedLabels(row.id, tokens.accessToken, tokens.refreshToken);
  } catch {
    // Connection is still valid; labels can be reconciled on the next scan.
    // Do not log token or email body content.
  }

  return toPublicConnection(row);
}

export async function disconnectGmailForUser(userId: string): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_connections")
    .select("id, encrypted_refresh_token")
    .eq("user_id", userId)
    .neq("status", "DISCONNECTED")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load Gmail connection for disconnect");
  }

  const rows = (data ?? []) as Array<{ id: string; encrypted_refresh_token: string | null }>;
  if (rows.length === 0) {
    return;
  }

  let key: string | null = null;
  try {
    key = getGmailEnv().TOKEN_ENCRYPTION_KEY;
  } catch {
    key = null;
  }

  for (const row of rows) {
    if (row.encrypted_refresh_token && key) {
      try {
        const refreshToken = decryptSecret(row.encrypted_refresh_token, key);
        await revokeRefreshToken(refreshToken);
      } catch {
        // Still mark disconnected locally if Google revoke fails.
      }
    }

    const { error: updateError } = await db
      .from("gmail_connections")
      .update({
        status: "DISCONNECTED",
        encrypted_refresh_token: null,
        next_scan_at: null,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error("Failed to disconnect Gmail");
    }
  }
}

export function gmailCallbackErrorRedirect(origin: string, reason: string): URL {
  const url = new URL("/dashboard", origin);
  url.searchParams.set("gmail", "error");
  url.searchParams.set("reason", reason);
  return url;
}
