/**
 * Product feature flags that are safe to read from server and client bundles.
 * Prefer a single boolean here over scattering env checks across UI trees.
 */

/**
 * When true, show the removable operator Usage screen (`/usage` + nav link).
 * Recording to `triage_usage` stays on regardless of this flag.
 * Set `NEXT_PUBLIC_USAGE_TELEMETRY_UI=1` to enable.
 */
export function isUsageTelemetryUiEnabled(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return source.NEXT_PUBLIC_USAGE_TELEMETRY_UI === "1";
}

/** Alias for docs and call sites that prefer a constant-style name. */
export const USAGE_TELEMETRY_UI = {
  isEnabled: isUsageTelemetryUiEnabled,
} as const;
