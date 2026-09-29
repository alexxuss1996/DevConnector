import { randomUUID } from "node:crypto";
import { createApp, type PluginOverrides } from "#app";

/**
 * `createApp` with the one override a test must never forget.
 *
 * The real rate limiter is on and its budgets are the production ones, so a
 * suite that fires more than 100 requests at a single address starts failing
 * with a 429 that has nothing to do with what it is testing. Keying per
 * request moves the bucket without relaxing the budget.
 *
 * This lives here rather than as a default on `createApp` because a default
 * would switch rate limiting OFF in production for any caller who omitted the
 * argument. A DoS control should fail shut. `test/app.test.ts` greps the test
 * tree and fails on any `createApp(` call that is not this helper, so the
 * convention is checkable instead of merely repeated.
 *
 * `overrides` is typed as `PluginOverrides`, so this follows the shape in
 * src/app.ts; a test needing production keying calls `createApp` directly and
 * marks the site `no-rate-limit-key:`.
 */
export function createRateLimitedTestApp(overrides: PluginOverrides = {}) {
  return createApp({
    logger: false,
    overrides: { ...overrides, rateLimitKey: () => randomUUID() },
  });
}
