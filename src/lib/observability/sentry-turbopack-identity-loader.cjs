"use strict";

/**
 * Identity Turbopack loader. Occupies Sentry's instrumentation matchers so
 * withSentryConfig does not register its webpack loader from inside
 * @sentry/nextjs (blocked by that package's "exports" map on Vercel).
 *
 * @param {string} source
 * @returns {string}
 */
module.exports = function sentryTurbopackIdentityLoader(source) {
  return source;
};
