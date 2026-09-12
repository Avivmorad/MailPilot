import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SENTRY_INSTRUMENTATION_CLIENT_MATCHER,
  SENTRY_INSTRUMENTATION_MATCHER,
  sentryInstrumentationTurbopackRules,
  sentryTurbopackIdentityLoaderPath,
} from "@/lib/observability/sentry-turbopack";

const require = createRequire(import.meta.url);

describe("sentry turbopack instrumentation rules", () => {
  it("occupies Sentry's instrumentation matchers with a repo-local loader", () => {
    const rules = sentryInstrumentationTurbopackRules("/repo");
    const loader = sentryTurbopackIdentityLoaderPath("/repo");

    expect(SENTRY_INSTRUMENTATION_CLIENT_MATCHER).toBe("**/instrumentation-client.*");
    expect(SENTRY_INSTRUMENTATION_MATCHER).toBe("**/instrumentation.*");
    expect(rules[SENTRY_INSTRUMENTATION_CLIENT_MATCHER]?.loaders[0]?.loader).toBe(loader);
    expect(rules[SENTRY_INSTRUMENTATION_MATCHER]?.loaders[0]?.loader).toBe(loader);
    expect(loader).toContain(path.join("src", "lib", "observability"));
    expect(loader).not.toContain(`${path.sep}node_modules${path.sep}@sentry${path.sep}`);
  });

  it("returns source unchanged so client instrumentation still compiles", () => {
    const loader = require("./sentry-turbopack-identity-loader.cjs") as (source: string) => string;
    const source = 'import * as Sentry from "@sentry/nextjs";\nSentry.init({});\n';
    expect(loader(source)).toBe(source);
  });
});
