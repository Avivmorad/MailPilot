import type { ErrorEvent, TransactionEvent } from "@sentry/core";

import { sanitizeSentryEvent, sentryEnvironment } from "@/lib/observability/sentry-privacy";

export function sentryInitOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: sentryEnvironment(),
    sendDefaultPii: false,
    enableLogs: false,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    beforeSend(event: ErrorEvent) {
      return sanitizeSentryEvent(event) as ErrorEvent | null;
    },
    beforeSendTransaction(event: TransactionEvent) {
      return sanitizeSentryEvent(event) as TransactionEvent | null;
    },
  };
}
