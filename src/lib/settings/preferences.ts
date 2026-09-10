import { z } from "zod";

import { nextDailyScanAt } from "@/lib/scans/schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_SCAN_TIMEZONE = "Asia/Jerusalem";
export const DEFAULT_DAILY_SCAN_TIME = "08:00";

const timeHmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const patchScanPreferencesSchema = z
  .object({
    dailyScanTime: timeHmSchema.optional(),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine(isValidTimeZone, { message: "invalid_timezone" })
      .optional(),
  })
  .refine((value) => value.dailyScanTime !== undefined || value.timezone !== undefined, {
    message: "empty",
  });

export interface ScanPreferences {
  dailyScanTime: string;
  timezone: string;
}

function normalizeTime(value: string | null): string {
  if (!value) {
    return DEFAULT_DAILY_SCAN_TIME;
  }
  return value.slice(0, 5);
}

export async function getScanPreferences(userId: string): Promise<ScanPreferences> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("user_triage_settings")
    .upsert(
      {
        user_id: userId,
        initial_lookback_days: 7,
        daily_scan_time: DEFAULT_DAILY_SCAN_TIME,
        timezone: DEFAULT_SCAN_TIMEZONE,
        scan_interval_minutes: null,
      },
      { onConflict: "user_id" },
    )
    .select("daily_scan_time, timezone")
    .single();
  if (error || !data) {
    throw new Error("Failed to load scan preferences");
  }
  return {
    dailyScanTime: normalizeTime(data.daily_scan_time as string | null),
    timezone: (data.timezone as string | null) || DEFAULT_SCAN_TIMEZONE,
  };
}

export async function updateScanPreferences(
  userId: string,
  patch: z.infer<typeof patchScanPreferencesSchema>,
): Promise<ScanPreferences> {
  const current = await getScanPreferences(userId);
  const next: ScanPreferences = {
    dailyScanTime: patch.dailyScanTime ?? current.dailyScanTime,
    timezone: patch.timezone ?? current.timezone,
  };

  const db = createAdminClient();
  const { error } = await db
    .from("user_triage_settings")
    .update({
      daily_scan_time: next.dailyScanTime,
      timezone: next.timezone,
      scan_interval_minutes: null,
    })
    .eq("user_id", userId);
  if (error) {
    throw new Error("Failed to update scan preferences");
  }

  const nextScanAt = nextDailyScanAt(new Date(), next.dailyScanTime, next.timezone).toISOString();
  const { error: connectionError } = await db
    .from("gmail_connections")
    .update({ next_scan_at: nextScanAt })
    .eq("user_id", userId)
    .eq("status", "CONNECTED");
  if (connectionError) {
    throw new Error("Failed to reschedule Gmail scans");
  }

  return next;
}
