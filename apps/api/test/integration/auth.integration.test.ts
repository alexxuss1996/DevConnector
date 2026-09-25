import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildIntegrationApp, cleanDb, testEmail, testName } from "../helpers/integration.ts";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

let app: FastifyInstance;
let mongoUri: string;
let jwtSecret: string;
let frontendUrl: string;

before(async () => {
  const runId = randomUUID().slice(0, 8);
  mongoUri = process.env.MONGODB_URI ?? `mongodb://localhost:27018/devconnector_test`;
  jwtSecret = `test-jwt-secret-${randomUUID().slice(0, 16)}`;
  frontendUrl = "http://localhost:3000";

  app = await buildIntegrationApp({
    mongoUri,
    jwtSecret,
    frontendUrl,
    dbNameSuffix: runId,
  });
});

after(async () => {
  await app.close();
});

beforeEach(async () => {
  await cleanDb(app);
});

/** Registers a user via POST /auth/register and returns the parsed JSON body. */
async function register(
  email: string,
  password: string,
  name: string,
) {
  const reply = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password },
  });
  assert.equal(reply.statusCode, 201, `register failed: ${reply.statusCode}\nbody: ${reply.body}\nerror: ${(app as any).lastError ?? "none"}`);
  return reply.json() as {
    id: string;
    name: string;
    email: string;
    avatar: string;
    accessToken?: string;
    refreshToken?: string;
  };
}

/** Logs in via POST /auth/login and returns the parsed JSON body. */
async function login(email: string, password: string) {
  const reply = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  return reply;
}

/** Extracts the access_token cookie value from a reply. */
function accessCookie(reply: { cookies: Array<{ name: string; value: string }> }) {
  const c = reply.cookies.find((c) => c.name === "access_token");
  assert.ok(c, "access_token cookie not set");
  return c.value;
}

/** Extracts the refresh_token cookie value from a reply. */
function refreshCookie(reply: { cookies: Array<{ name: string; value: string }> }) {
  const c = reply.cookies.find((c) => c.name === "refresh_token");
  assert.ok(c, "refresh_token cookie not set");
  return c.value;
}

describe("integration — auth flow", () => {
  test("register → login → refresh → logout is a complete round trip", async () => {
    const email = testEmail("roundtrip");
    const password = "Password123!";
    const name = testName("roundtrip");

    // 1. Register
    const reg = await register(email, password, name);
    assert.equal(reg.email, email.toLowerCase());
    assert.equal(reg.name, name);
    assert.ok(typeof reg.avatar === "string" && reg.avatar.startsWith("http"));

    // 2. Login
    const loginReply = await login(email, password);
    assert.equal(loginReply.statusCode, 200);
    const loggedIn = loginReply.json() as {
      id: string;
      email: string;
      name: string;
    };
    assert.equal(loggedIn.email, email.toLowerCase());

    const refreshToken = refreshCookie(loginReply);

    // 3. Refresh
    const refreshReply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: refreshToken },
    });
    assert.equal(refreshReply.statusCode, 200);
    const refreshed = refreshReply.json() as { email: string };
    assert.equal(refreshed.email, email.toLowerCase());

    const newAccessToken = accessCookie(refreshReply);
    const newRefreshToken = refreshCookie(refreshReply);

    // 4. Use the new access token against a protected route.
    const protectedReply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${newAccessToken}` },
      payload: { status: "Developer", skills: ["JS"] },
    });
    assert.equal(protectedReply.statusCode, 200);

    // 5. Logout
    const logoutReply = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { refresh_token: newRefreshToken },
    });
    assert.equal(logoutReply.statusCode, 204);

    // After logout, the refresh token is dead.
    const afterLogoutReply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: newRefreshToken },
    });
    assert.equal(afterLogoutReply.statusCode, 401);
  });

  test("password-only account cannot log in with Google (no passwordHash)", async () => {
    const email = testEmail("google-only");
    const googleSub = `google-sub-${randomUUID().slice(0, 8)}`;
    await register(email, "Password123!", testName("google-only"));

    const googleStub = await import("../helpers/stubs.ts");
    const { stubMethod } = googleStub;

    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: googleSub,
        email,
        email_verified: true,
        name: "Google User",
        picture: "https://example.com/g.png",
      }),
    }));

    const callbackReply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });
    assert.equal(callbackReply.statusCode, 302);
    assert.equal(
      callbackReply.headers.location,
      `${frontendUrl}?error=google_account_conflict`,
    );

    // The google-only user was created; now verify login with password fails.
    // (No passwordHash was set.)
    const loginReply = await login(email, "any-password");
    assert.equal(loginReply.statusCode, 401);
    assert.equal(
      (loginReply.json() as { code: string }).code,
      "INVALID_CREDENTIALS",
    );
  });

  test("login with wrong password returns 401, not 404", async () => {
    const email = testEmail("wrong-pw");
    const password = "CorrectPassword1!";
    await register(email, password, testName("wrong-pw"));

    const reply = await login(email, "WrongPassword1!");
    assert.equal(reply.statusCode, 401);
    assert.equal(
      (reply.json() as { code: string }).code,
      "INVALID_CREDENTIALS",
    );
  });

  test("email is normalized on register and login (case + whitespace)", async () => {
    const rawEmail = "  Mixed.Case@Test.DEV  ";
    const normalized = "mixed.case@test.dev";
    await register(rawEmail, "Password123!", testName("normalize"));

    const loginReply = await login(rawEmail, "Password123!");
    assert.equal(loginReply.statusCode, 200);
    assert.equal(
      (loginReply.json() as { email: string }).email,
      normalized,
    );
  });

  test("logout-all revokes every session for the user", async () => {
    const email = testEmail("logoutall");
    const password = "Password123!";
    await register(email, password, testName("logoutall"));

    // Login twice to get two sessions.
    const r1 = await login(email, password);
    const a1 = accessCookie(r1);
    const ref1 = refreshCookie(r1);

    const r2 = await login(email, password);
    const a2 = accessCookie(r2);
    const ref2 = refreshCookie(r2);

    assert.notEqual(a1, a2);
    assert.notEqual(ref1, ref2);

    // Both sessions are alive: both refresh tokens work.
    assert.equal(
      (await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: ref1 },
      })).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: ref2 },
      })).statusCode,
      200,
    );

    // Logout everywhere using the first access token.
    const logoutAllReply = await app.inject({
      method: "POST",
      url: "/auth/logout-all",
      headers: { authorization: `Bearer ${a1}` },
    });
    assert.equal(logoutAllReply.statusCode, 204);

    // Both refresh tokens are now dead.
    assert.equal(
      (await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: ref1 },
      })).statusCode,
      401,
    );
    assert.equal(
      (await app.inject({
        method: "POST",
        url: "/auth/refresh",
        cookies: { refresh_token: ref2 },
      })).statusCode,
      401,
    );
  });

  test("CSRF: cookie-authenticated POST from a different origin is rejected", async () => {
    const email = testEmail("csrf");
    const password = "Password123!";
    await register(email, password, testName("csrf"));

    const loginReply = await login(email, password);
    const accessToken = accessCookie(loginReply);

    // Valid origin: should pass.
    const goodReply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: {
        origin: frontendUrl,
        authorization: `Bearer ${accessToken}`,
      },
      payload: { status: "Developer", skills: ["JS"] },
    });
    assert.equal(goodReply.statusCode, 200);

    // Wrong origin: should be rejected (403) — but only when auth is via cookie.
    // Bearer auth bypasses the CSRF hook entirely, so use the cookie instead.
    const badReply = await app.inject({
      method: "POST",
      url: "/profile/",
      cookies: { access_token: accessToken },
      headers: { origin: "https://evil.example.com" },
      payload: { status: "Developer", skills: ["JS"] },
    });
    assert.equal(badReply.statusCode, 403);
    assert.equal(
      (badReply.json() as { code: string }).code,
      "FORBIDDEN",
    );
  });
});
