import { createAdminClient } from "@/lib/supabase/admin";

export const SCAN_LEASE_SECONDS = 20 * 60;

export interface ClaimedConnection {
  id: string;
  userId: string;
  gmailEmail: string;
}

function asClaimed(row: { id: string; user_id: string; gmail_email: string }): ClaimedConnection {
  return { id: row.id, userId: row.user_id, gmailEmail: row.gmail_email };
}

/**
 * Atomically claim due CONNECTED Gmail accounts. Prefers the private RPC
 * (`FOR UPDATE SKIP LOCKED`); falls back to optimistic row updates.
 */
export async function claimDueConnections(input: {
  workerId: string;
  limit?: number;
  now?: Date;
  leaseSeconds?: number;
}): Promise<ClaimedConnection[]> {
  const limit = input.limit ?? 3;
  const leaseSeconds = input.leaseSeconds ?? SCAN_LEASE_SECONDS;
  const db = createAdminClient();

  const { data, error } = await db
    .schema("private")
    .rpc("claim_due_gmail_connections", {
      p_worker: input.workerId,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });

  if (!error && Array.isArray(data)) {
    return (data as Array<{ id: string; user_id: string; gmail_email: string }>).map(asClaimed);
  }

  return claimDueConnectionsOptimistic({
    workerId: input.workerId,
    limit,
    now: input.now ?? new Date(),
    leaseSeconds,
  });
}

async function claimDueConnectionsOptimistic(input: {
  workerId: string;
  limit: number;
  now: Date;
  leaseSeconds: number;
}): Promise<ClaimedConnection[]> {
  const db = createAdminClient();
  const nowIso = input.now.toISOString();
  const { data, error } = await db
    .from("gmail_connections")
    .select("id, user_id, gmail_email, lease_expires_at")
    .eq("status", "CONNECTED")
    .not("next_scan_at", "is", null)
    .lte("next_scan_at", nowIso)
    .order("next_scan_at", { ascending: true })
    .limit(Math.max(input.limit * 3, input.limit));

  if (error || !data) {
    return [];
  }

  const claimed: ClaimedConnection[] = [];
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseSeconds * 1000).toISOString();

  for (const row of data) {
    if (claimed.length >= input.limit) {
      break;
    }
    const lease = row.lease_expires_at ? Date.parse(row.lease_expires_at as string) : NaN;
    if (Number.isFinite(lease) && lease > input.now.getTime()) {
      continue;
    }

    const { data: updated, error: updateError } = await db
      .from("gmail_connections")
      .update({
        locked_at: nowIso,
        locked_by: input.workerId,
        lease_expires_at: leaseExpiresAt,
      })
      .eq("id", row.id)
      .eq("status", "CONNECTED")
      .lte("next_scan_at", nowIso)
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
      .select("id, user_id, gmail_email")
      .maybeSingle();

    if (updateError || !updated) {
      continue;
    }
    claimed.push(asClaimed(updated as { id: string; user_id: string; gmail_email: string }));
  }

  return claimed;
}

export async function releaseConnectionLease(connectionId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("gmail_connections")
    .update({
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq("id", connectionId);
  if (error) {
    throw new Error("Failed to release scan lease");
  }
}
