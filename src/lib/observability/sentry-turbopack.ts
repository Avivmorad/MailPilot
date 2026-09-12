import path from "node:path";

/** Matchers Sentry uses in generateValueInjectionRules (must stay exact). */
export const SENTRY_INSTRUMENTATION_CLIENT_MATCHER = "**/instrumentation-client.*";
export const SENTRY_INSTRUMENTATION_MATCHER = "**/instrumentation.*";

export function sentryTurbopackIdentityLoaderPath(cwd = process.cwd()) {
  return path.join(cwd, "src/lib/observability/sentry-turbopack-identity-loader.cjs");
}

export function sentryInstrumentationTurbopackRules(cwd = process.cwd()) {
  const loader = sentryTurbopackIdentityLoaderPath(cwd);
  return {
    [SENTRY_INSTRUMENTATION_CLIENT_MATCHER]: {
      loaders: [{ loader }],
    },
    [SENTRY_INSTRUMENTATION_MATCHER]: {
      loaders: [{ loader }],
    },
  };
}
