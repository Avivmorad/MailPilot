export interface GmailRequestBudget {
  deadlineAt?: number;
  signal?: AbortSignal;
}

export class GmailDeadlineError extends Error {
  constructor() {
    super("Gmail slice deadline reached");
    this.name = "GmailDeadlineError";
  }
}

export class GmailRequestTimeoutError extends Error {
  constructor() {
    super("Gmail request timed out");
    this.name = "GmailRequestTimeoutError";
  }
}

export const GMAIL_REQUEST_TIMEOUT_MS = 30_000;

export function assertGmailBudget(budget: GmailRequestBudget): void {
  budget.signal?.throwIfAborted();
  if (budget.deadlineAt !== undefined && Date.now() >= budget.deadlineAt) {
    throw new GmailDeadlineError();
  }
}

export async function withGmailRequest<T>(
  operation: (options: { signal: AbortSignal; timeout: number; retry: false }) => Promise<T>,
  budget: GmailRequestBudget & { requestTimeoutMs?: number } = {},
): Promise<T> {
  assertGmailBudget(budget);
  const remaining = budget.deadlineAt === undefined ? Infinity : budget.deadlineAt - Date.now();
  const requestTimeout = budget.requestTimeoutMs ?? GMAIL_REQUEST_TIMEOUT_MS;
  const timeout = Math.min(requestTimeout, remaining);
  const controller = new AbortController();
  const cancel = () => controller.abort(budget.signal?.reason);
  budget.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    controller.abort(
      remaining <= requestTimeout ? new GmailDeadlineError() : new GmailRequestTimeoutError(),
    );
  }, timeout);
  let rejectOnAbort: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation({ signal: controller.signal, timeout, retry: false });
      }),
      interrupted,
    ]);
  } finally {
    clearTimeout(timer);
    budget.signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectOnAbort!);
  }
}

export async function waitForGmailBudget(
  ms: number,
  budget: GmailRequestBudget = {},
  sleep?: (ms: number) => Promise<void>,
): Promise<void> {
  assertGmailBudget(budget);
  if (budget.deadlineAt !== undefined && ms >= budget.deadlineAt - Date.now()) {
    throw new GmailDeadlineError();
  }
  await withGmailRequest(
    ({ signal }) =>
      sleep
        ? sleep(ms)
        : new Promise<void>((resolve, reject) => {
            const cancel = () => {
              clearTimeout(timer);
              reject(signal.reason);
            };
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", cancel);
              resolve();
            }, ms);
            signal.addEventListener("abort", cancel, { once: true });
          }),
    { ...budget, requestTimeoutMs: ms + 1 },
  );
}
