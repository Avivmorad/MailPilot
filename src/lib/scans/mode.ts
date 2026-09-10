import type { ConnectionScanState, ScanDiscoveryMode } from "@/lib/scans/types";

export function plannedDiscoveryMode(
  state: ConnectionScanState,
  options: { forceLookback?: boolean } = {},
): ScanDiscoveryMode {
  if (options.forceLookback) {
    return "INITIAL";
  }
  if (state.historyId && state.lastSuccessfulScanAt) {
    return "INCREMENTAL";
  }
  if (state.lastSuccessfulScanAt) {
    return "RECOVERY";
  }
  return "INITIAL";
}
