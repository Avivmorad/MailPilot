/** Vercel Hobby serverless maxDuration is 1–300 seconds. */
export const DISPATCH_MAX_DURATION_SECONDS = 300;
/** Stop claiming work before the function is killed. */
export const DISPATCH_BUDGET_MS = 270_000;
export const DISPATCH_LEASE_SECONDS = DISPATCH_MAX_DURATION_SECONDS;
/** One connection per invocation so a run can finish inside the Hobby cap. */
export const DISPATCH_DEFAULT_LIMIT = 1;

export function hasDispatchBudget(
  startedAtMs: number,
  nowMs = Date.now(),
  budgetMs = DISPATCH_BUDGET_MS,
): boolean {
  return nowMs - startedAtMs < budgetMs;
}
