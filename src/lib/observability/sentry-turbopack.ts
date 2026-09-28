import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const rules = require("./sentry-turbopack-rules.cjs") as {
  SENTRY_INSTRUMENTATION_CLIENT_MATCHER: string;
  SENTRY_INSTRUMENTATION_MATCHER: string;
  sentryTurbopackIdentityLoaderPath: (cwd?: string) => string;
  sentryInstrumentationTurbopackRules: (cwd?: string) => {
    [matcher: string]: { loaders: { loader: string }[] };
  };
};

/** Matchers Sentry uses in generateValueInjectionRules (must stay exact). */
export const SENTRY_INSTRUMENTATION_CLIENT_MATCHER = rules.SENTRY_INSTRUMENTATION_CLIENT_MATCHER;
export const SENTRY_INSTRUMENTATION_MATCHER = rules.SENTRY_INSTRUMENTATION_MATCHER;
export const sentryTurbopackIdentityLoaderPath = rules.sentryTurbopackIdentityLoaderPath;
export const sentryInstrumentationTurbopackRules = rules.sentryInstrumentationTurbopackRules;
