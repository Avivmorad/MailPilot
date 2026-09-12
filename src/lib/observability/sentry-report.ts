import * as Sentry from "@sentry/nextjs";

import {
  pickAllowedSentryTags,
  sentryEnvironment,
  sentryErrorCategoryFromError,
  sentryProviderFromError,
  type SentrySafeTags,
} from "@/lib/observability/sentry-privacy";

/**
 * Capture an exception with only the MailPilot-allowed Sentry tags.
 * Never attach extras, users, request bodies, or email addresses.
 */
export function captureSafeException(error: unknown, tags: SentrySafeTags = {}): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    const allowed = pickAllowedSentryTags({
      environment: sentryEnvironment(),
      provider: sentryProviderFromError(error),
      error_category: sentryErrorCategoryFromError(error),
      ...tags,
    });
    for (const [key, value] of Object.entries(allowed)) {
      scope.setTag(key, value);
    }
    Sentry.captureException(error);
  });
}
