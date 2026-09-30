import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { trustedProxyHops, isProduction } from "#config/env";

/**
 * Runs `body` with an env var set, restoring the prior value exactly.
 *
 * `process.env.X = undefined` stores the string "undefined" rather than
 * unsetting, so a leaking test breaks every test that runs after it.
 */
function withEnv<T>(name: string, value: string | undefined, body: () => T): T {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return body();
  } finally {
    if (prev === undefined) delete process.env[name];
    else process.env[name] = prev;
  }
}

describe("trustedProxyHops", () => {
  // The default matters more than the option. Trusting one hop with no proxy
  // in front makes `request.ip` the client-supplied X-Forwarded-For, so an
  // attacker rotates the header and defeats the per-IP login rate limit.
  test("defaults to trusting nothing when TRUST_PROXY_HOPS is unset", () => {
    withEnv("TRUST_PROXY_HOPS", undefined, () => {
      assert.equal(trustedProxyHops(), false);
    });
  });

  test("defaults to trusting nothing when TRUST_PROXY_HOPS is empty", () => {
    // `TRUST_PROXY_HOPS=` is the idiomatic "off" in a compose file. Genuinely
    // empty is unambiguous, so it is not an error.
    withEnv("TRUST_PROXY_HOPS", "", () => {
      assert.equal(trustedProxyHops(), false);
    });
  });

  test("tolerates whitespace around a real count", () => {
    // `Number(" 1 ")` is 1, so a stray space in a YAML value is not a typo.
    withEnv("TRUST_PROXY_HOPS", " 1 ", () => {
      assert.equal(trustedProxyHops(), 1);
    });
  });

  test("returns the configured hop count", () => {
    withEnv("TRUST_PROXY_HOPS", "1", () => {
      assert.equal(trustedProxyHops(), 1);
    });
    withEnv("TRUST_PROXY_HOPS", "2", () => {
      assert.equal(trustedProxyHops(), 2);
    });
  });

  // `parseInt` would return NaN for each of these, and Fastify reads a NaN hop
  // count as "trust nothing" — silently the pre-change behaviour, which is the
  // one the operator was setting the variable to avoid. A whitespace-only value
  // is here too: it is a typo, not an unset, and reading it as unset is the
  // silent failure this function exists to catch.
  for (const bad of ["abc", "1x", "-1", "0", "1.5", "true", " "]) {
    test(`rejects TRUST_PROXY_HOPS=${JSON.stringify(bad)} rather than silently trusting nothing`, () => {
      withEnv("TRUST_PROXY_HOPS", bad, () => {
        assert.throws(() => trustedProxyHops(), /TRUST_PROXY_HOPS/);
      });
    });
  }
});

describe("isProduction", () => {
  for (const known of ["development", "test", "staging"]) {
    test(`isProduction() is false for ${known}`, () => {
      withEnv("NODE_ENV", known, () => {
        assert.equal(isProduction(), false);
      });
    });
  }

  test("isProduction() is true for production", () => {
    withEnv("NODE_ENV", "production", () => {
      assert.equal(isProduction(), true);
    });
  });

  for (const bad of ["prod", "Production", "PROD", "dev"]) {
    test(`isProduction() throws for ${bad} rather than downgrading to insecure`, () => {
      withEnv("NODE_ENV", bad, () => {
        assert.throws(() => isProduction(), /NODE_ENV/);
      });
    });
  }
});
