/** Vercel Hobby serverless maxDuration is 1–300 seconds. */
export const DISPATCH_MAX_DURATION_SECONDS = 300;
/** Stop claiming work before the function is killed. */
export const DISPATCH_BUDGET_MS = 270_000;
export const DISPATCH_LEASE_SECONDS = Math.floor(DISPATCH_BUDGET_MS / 1000);
/** One connection per invocation so a run can finish inside the Hobby cap. */
export const DISPATCH_DEFAULT_LIMIT = 1;
/** Leave headroom inside maxDuration for persist + HTTP continue. */
export const SCAN_WORK_BUDGET_MS = 240_000;
/** No progress for this long → treat the RUNNING row as dead. */
export const SCAN_STALE_PROGRESS_MS = 20 * 60 * 1000;
/** Dispatcher must not resume a slice that is still working. */
export const SCAN_HEARTBEAT_BUSY_MS = SCAN_WORK_BUDGET_MS + 30_000;
/** Fallback continue if the self-fetch never starts the next slice. */
export const SCAN_CONTINUE_RETRY_MS = 5 * 60_000;

export function hasDispatchBudget(
  startedAtMs: number,
  nowMs = Date.now(),
  budgetMs = DISPATCH_BUDGET_MS,
): boolean {
  return nowMs - startedAtMs < budgetMs;
}
