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
  GmailConnectError,
  revokeRefreshToken,
} from "@/lib/gmail/oauth";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { nextDailyScanAt } from "@/lib/scans/schedule";
import { getScanPreferences } from "@/lib/settings/preferences";
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

/**
 * Map a PostgREST/Postgres error to copy that is safe to show in the UI.
 * Does not include tokens, email bodies, or raw connection strings.
 */
export function gmailStatusErrorMessage(error: {
  code?: string | null;
  message?: string | null;
}): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    (/gmail_connections/i.test(message) && /does not exist|schema cache|could not find/i.test(message))
  ) {
    return "The gmail_connections table is missing. Apply supabase/migrations/0002_gmail_connections.sql in the Supabase SQL Editor, then reload.";
  }
  if (code === "42501" || /permission denied/i.test(message)) {
    return "Database permission denied for Gmail connections. Re-run 0002_gmail_connections.sql in the SQL Editor.";
  }
  if (code === "PGRST301" || /jwt|invalid api key|invalid authentication/i.test(message)) {
    return "Supabase rejected the server key. Check SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the dev server.";
  }
  return "Could not load Gmail connection status from the database.";
}

export async function getGmailStatusForUser(userId: string): Promise<GmailStatusPayload> {
  const configured = isGmailConfigured();
  if (!configured) {
    return { configured: false, connection: null, loadError: null };
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("gmail_connections")
      .select("id, user_id, gmail_email, google_account_id, status, last_successful_scan_at, next_scan_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[gmail.status]", { code: error.code, message: error.message });
      return {
        configured: true,
        connection: null,
        loadError: gmailStatusErrorMessage(error),
      };
    }

    return {
      configured: true,
      connection: data ? toPublicConnection(data as ConnectionRow) : null,
      loadError: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[gmail.status]", { message });
    return {
      configured: true,
      connection: null,
      loadError: "Could not load Gmail connection status from the database.",
    };
  }
}

export async function completeGmailOAuth(userId: string, code: string): Promise<GmailConnectionPublic> {
  const env = getGmailEnv();
  const tokens = await exchangeAuthorizationCode(code);
  const identity = await fetchGmailIdentity(tokens.accessToken, tokens.refreshToken);

  let encryptedRefreshToken: string;
  try {
    encryptedRefreshToken = encryptSecret(tokens.refreshToken, env.TOKEN_ENCRYPTION_KEY);
  } catch {
    throw new GmailConnectError(
      "encryption_key",
      "TOKEN_ENCRYPTION_KEY must be a 32-byte key (openssl rand -hex 32)",
    );
  }

  const db = createAdminClient();
  const { error: profileError } = await db.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  if (profileError) {
    console.error("[gmail.connect]", { step: "profile", code: profileError.code, message: profileError.message });
    throw new GmailConnectError("persist", "Failed to persist profile for Gmail connection");
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
    console.error("[gmail.connect]", { step: "connection", code: error?.code, message: error?.message });
    throw new GmailConnectError("persist", "Failed to persist Gmail connection");
  }

  const row = data as ConnectionRow;

  if (!row.next_scan_at) {
    try {
      const preferences = await getScanPreferences(userId);
      const nextScanAt = nextDailyScanAt(
        new Date(),
        preferences.dailyScanTime,
        preferences.timezone,
      ).toISOString();
      const { error: scheduleError } = await db
        .from("gmail_connections")
        .update({ next_scan_at: nextScanAt })
        .eq("id", row.id);
      if (!scheduleError) {
        row.next_scan_at = nextScanAt;
      }
    } catch {
      // Connection is valid; the next successful scan will set next_scan_at.
    }
  }

  try {
    await ensureManagedLabels(row.id, tokens.accessToken, tokens.refreshToken);
  } catch {
    // Connection is still valid; labels can be reconciled on the next scan.
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
