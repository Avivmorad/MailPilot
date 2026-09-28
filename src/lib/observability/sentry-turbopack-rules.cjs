"use strict";

const path = require("node:path");

const SENTRY_INSTRUMENTATION_CLIENT_MATCHER = "**/instrumentation-client.*";
const SENTRY_INSTRUMENTATION_MATCHER = "**/instrumentation.*";

function sentryTurbopackIdentityLoaderPath(cwd = process.cwd()) {
  return path.join(cwd, "src/lib/observability/sentry-turbopack-identity-loader.cjs");
}

function sentryInstrumentationTurbopackRules(cwd = process.cwd()) {
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

module.exports = {
  SENTRY_INSTRUMENTATION_CLIENT_MATCHER,
  SENTRY_INSTRUMENTATION_MATCHER,
  sentryTurbopackIdentityLoaderPath,
  sentryInstrumentationTurbopackRules,
};
