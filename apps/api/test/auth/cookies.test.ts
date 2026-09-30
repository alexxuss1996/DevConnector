import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply } from "fastify";
import { setAuthCookies, clearAuthCookies } from "#helpers/auth.cookies";

interface StoredCookie {
  value?: string;
  opts: Record<string, unknown>;
  cleared?: boolean;
}

function fakeReply(): {
  reply: FastifyReply;
  cookies: Record<string, StoredCookie>;
} {
  const cookies: Record<string, StoredCookie> = {};
  const reply: Record<string, unknown> = {
    setCookie: (name: string, value: string, opts: Record<string, unknown>) => {
      cookies[name] = { value, opts };
      return reply;
    },
    clearCookie: (name: string, opts: Record<string, unknown>) => {
      cookies[name] = { cleared: true, opts };
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, cookies };
}

/**
 * Runs `body` with NODE_ENV set to `value`, then restores the prior value.
 *
 * `process.env.X = undefined` does not unset X — it stores the string
 * "undefined", which `isProduction` then rejects. A test that leaks that way
 * fails every test after it, so restore by deleting when there was no prior
 * value.
 */
function withNodeEnv<T>(value: string, body: () => T): T {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return body();
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
}

describe("auth.cookies", () => {
  test("setAuthCookies sets httpOnly access and refresh cookies", () => {
    const { reply, cookies } = fakeReply();

    const ret = setAuthCookies(reply, "access-jwt", "refresh-jwt");

    assert.equal(ret, reply);
    assert.deepEqual(Object.keys(cookies).sort(), [
      "access_token",
      "refresh_token",
    ]);

    assert.equal(cookies.access_token.value, "access-jwt");
    assert.equal(cookies.access_token.opts.httpOnly, true);
    assert.equal(cookies.access_token.opts.sameSite, "lax");
    assert.equal(cookies.access_token.opts.path, "/");
    assert.equal(cookies.access_token.opts.secure, false);
    assert.equal(cookies.access_token.opts.maxAge, 60 * 15);

    assert.equal(cookies.refresh_token.value, "refresh-jwt");
    assert.equal(cookies.refresh_token.opts.httpOnly, true);
    assert.equal(cookies.refresh_token.opts.sameSite, "lax");
    assert.equal(cookies.refresh_token.opts.path, "/auth");
    assert.equal(cookies.refresh_token.opts.secure, false);
    assert.equal(cookies.refresh_token.opts.maxAge, 60 * 60 * 24 * 30);
  });

  test("setAuthCookies marks cookies as secure when NODE_ENV is production", () => {
    withNodeEnv("production", () => {
      const { reply, cookies } = fakeReply();
      setAuthCookies(reply, "a", "b");
      assert.equal(cookies["access_token"]?.opts.secure, true);
      assert.equal(cookies["refresh_token"]?.opts.secure, true);
    });
  });

  // Cross-site deployment: the frontend on Vercel, the API elsewhere. A `Lax`
  // cookie is not attached to a cross-site fetch, so login would appear to
  // succeed and every later call would 401.
  test("setAuthCookies uses SameSite=None in production so cross-site fetches carry the cookie", () => {
    withNodeEnv("production", () => {
      const { reply, cookies } = fakeReply();
      setAuthCookies(reply, "a", "b");
      assert.equal(cookies["access_token"]?.opts.sameSite, "none");
      assert.equal(cookies["refresh_token"]?.opts.sameSite, "none");
    });
  });

  // Browsers reject SameSite=None without Secure, and reject the pair silently
  // by dropping the cookie. Both flags come from one isProduction() call, so
  // assert the pairing rather than each flag alone.
  test("SameSite=None is never emitted without Secure", () => {
    for (const env of ["production"]) {
      withNodeEnv(env, () => {
        const { reply, cookies } = fakeReply();
        setAuthCookies(reply, "a", "b");
        for (const name of ["access_token", "refresh_token"] as const) {
          const opts = cookies[name]?.opts as
            | { sameSite?: string; secure?: boolean }
            | undefined;
          if (opts?.sameSite === "none") {
            assert.equal(opts.secure, true, `${name} under NODE_ENV=${env}`);
          }
        }
      });
    }
  });

  // A stale cookie set under the old attributes is only replaced if the
  // clearing cookie matches on path AND SameSite, so the clear path has to
  // carry the same value as the set path.
  test("clearAuthCookies matches the SameSite it was set with", () => {
    withNodeEnv("production", () => {
      const set = fakeReply();
      setAuthCookies(set.reply, "a", "b");
      const cleared = fakeReply();
      clearAuthCookies(cleared.reply);

      for (const name of ["access_token", "refresh_token"] as const) {
        assert.equal(
          cleared.cookies[name]?.opts.sameSite,
          set.cookies[name]?.opts.sameSite,
        );
        assert.equal(
          cleared.cookies[name]?.opts.path,
          set.cookies[name]?.opts.path,
        );
      }
    });
  });

  // Local development is same-site: localhost:4000 and localhost:3000 are the
  // same site, so Lax applies and is the stricter choice.
  for (const known of ["development", "test", "staging"]) {
    test(`setAuthCookies keeps SameSite=Lax under NODE_ENV=${known}`, () => {
      withNodeEnv(known, () => {
        const { reply, cookies } = fakeReply();
        setAuthCookies(reply, "a", "b");
        assert.equal(cookies["access_token"]?.opts.sameSite, "lax");
        assert.equal(cookies["refresh_token"]?.opts.sameSite, "lax");
      });
    });
  }

  // A typo'd NODE_ENV used to read as "not production" and silently drop
  // Secure from a 30-day refresh token. Unrecognised values are now an error
  // rather than a downgrade. "staging" is deliberately absent: it is a real
  // accepted value in KNOWN_ENVIRONMENTS, just not production.
  for (const bogus of ["prod", "Production", "PROD", "dev", "prod "]) {
    test(`setAuthCookies rejects NODE_ENV=${JSON.stringify(bogus)} rather than dropping Secure`, () => {
      withNodeEnv(bogus, () => {
        const { reply } = fakeReply();
        assert.throws(() => setAuthCookies(reply, "a", "b"), /NODE_ENV/);
        assert.throws(() => clearAuthCookies(reply), /NODE_ENV/);
      });
    });
  }

  for (const known of ["development", "test", "staging"]) {
    test(`setAuthCookies accepts NODE_ENV=${known} without Secure`, () => {
      withNodeEnv(known, () => {
        const { reply, cookies } = fakeReply();
        setAuthCookies(reply, "a", "b");
        assert.equal(cookies["access_token"]?.opts.secure, false);
      });
    });
  }

  // Unset is the one value that means "not production" without being a typo,
  // so it must not throw — a dev with no NODE_ENV exported still gets cookies.
  test("setAuthCookies treats an unset NODE_ENV as development", () => {
    const prev = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const { reply, cookies } = fakeReply();
      setAuthCookies(reply, "a", "b");
      assert.equal(cookies["access_token"]?.opts.secure, false);
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });

  test("clearAuthCookies clears both cookies at their original paths", () => {
    const { reply, cookies } = fakeReply();

    const ret = clearAuthCookies(reply);

    assert.equal(ret, reply);
    assert.equal(cookies.access_token.cleared, true);
    assert.equal(cookies.access_token.opts.path, "/");
    assert.equal(cookies.refresh_token.cleared, true);
    assert.equal(cookies.refresh_token.opts.path, "/auth");
  });
});
