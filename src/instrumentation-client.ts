import * as Sentry from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/observability/sentry-options";

Sentry.init(sentryInitOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
