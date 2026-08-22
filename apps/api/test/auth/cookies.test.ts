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

describe("auth.cookies", () => {
  test("setAuthCookies sets httpOnly access and refresh cookies", () => {
    const { reply, cookies } = fakeReply();

    const ret = setAuthCookies(reply, "access-jwt", "refresh-jwt");

    assert.equal(ret, reply);
    assert.deepEqual(Object.keys(cookies).sort(), ["access_token", "refresh_token"]);

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
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const { reply, cookies } = fakeReply();
      setAuthCookies(reply, "a", "b");
      assert.equal(cookies["access_token"]?.opts.secure, true);
      assert.equal(cookies["refresh_token"]?.opts.secure, true);
    } finally {
      process.env.NODE_ENV = prev;
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
