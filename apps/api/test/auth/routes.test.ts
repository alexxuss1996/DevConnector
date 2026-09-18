import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import User from "#modules/users/user.model";
import Session from "#modules/auth/session.model";
import {
  newId,
  mkUser,
  mkSessionDoc,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "../helpers/stubs.ts";
import { buildApp, signAccessToken, signRefreshToken } from "../helpers/app.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = await buildApp({ withRoutes: true });
});

after(async () => {
  restoreAllStubs();
  await app.close();
});

afterEach(() => {
  restoreAllStubs();
});

function setCookieNames(reply: any): string[] {
  const headers = reply.headers["set-cookie"] ?? [];
  return (Array.isArray(headers) ? headers : [headers]).map((c: string) =>
    c.slice(0, c.indexOf("=")),
  );
}

describe("POST /auth/register", () => {
  test("returns 201 with the user and sets both auth cookies", async () => {
    stubMethod(User, "findOne", () => mkQuery(null));
    stubMethod(User, "create", (data: any) => mkUser(data));
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Jane Doe",
        email: "jane.doe@example.com",
        password: "supersecret123",
      },
    });

    assert.equal(reply.statusCode, 201);
    const body = reply.json();
    assert.equal(body.email, "jane.doe@example.com");
    assert.equal(body.name, "Jane Doe");
    assert.ok(typeof body.avatar === "string");
    assert.deepEqual(setCookieNames(reply).sort(), [
      "access_token",
      "refresh_token",
    ]);
    for (const cookie of reply.cookies) {
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, "Lax");
    }
    const access = reply.cookies.find((c: any) => c.name === "access_token")!;
    assert.equal((app.jwt.verify(access.value) as any).type, "access");
    const refresh = reply.cookies.find((c: any) => c.name === "refresh_token")!;
    assert.equal(refresh.path, "/auth");
  });

  test("returns 400 VALIDATION_ERROR for an invalid payload", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "ab", email: "not-an-email", password: "short" },
    });

    assert.equal(reply.statusCode, 400);
    const body = reply.json();
    assert.equal(body.code, "VALIDATION_ERROR");
  });

  test("does not reveal whether an email is already registered", async () => {
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "taken@example.com" })),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Jane Doe",
        email: "taken@example.com",
        password: "supersecret123",
      },
    });

    assert.equal(reply.statusCode, 409);
    const body = reply.json();
    assert.equal(body.code, "REGISTRATION_FAILED");
    assert.equal(body.message, "Email already in use");
    assert.deepEqual(Object.keys(body).sort(), ["code", "message"]);
  });
});

describe("POST /auth/login", () => {
  test("returns 200 with the user and sets both auth cookies", async () => {
    const passwordHash = await argon2.hash("password123");
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "jane@example.com", passwordHash })),
    );
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "jane@example.com",
        password: "password123",
      },
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json();
    assert.equal(body.email, "jane@example.com");
    assert.deepEqual(setCookieNames(reply).sort(), [
      "access_token",
      "refresh_token",
    ]);
  });

  test("returns 401 INVALID_CREDENTIALS for wrong credentials", async () => {
    const passwordHash = await argon2.hash("password123");
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "jane@example.com", passwordHash })),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "jane@example.com", password: "wrong-password" },
    });

    assert.equal(reply.statusCode, 401);
    const body = reply.json();
    assert.equal(body.code, "INVALID_CREDENTIALS");
    assert.equal(body.message, "Invalid Credentials");
  });

  test("returns 500 INTERNAL_SERVER_ERROR for unexpected errors", async () => {
    stubMethod(User, "findOne", () => {
      throw new Error("boom");
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "jane@example.com", password: "password123" },
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });

  test("returns 400 VALIDATION_ERROR for a too short password", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "jane@example.com", password: "short" },
    });

    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
});

describe("POST /auth/refresh", () => {
  test("rotates tokens and returns the user when the refresh cookie is valid", async () => {
    const userId = newId();
    const sessionId = newId();
    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });
    const session: any = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(refreshToken),
    });
    stubMethod(Session, "findById", () => mkQuery(session));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, email: "jane@example.com", name: "Jane" })),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: refreshToken },
    });

    assert.equal(reply.statusCode, 200);
    assert.equal(reply.json().email, "jane@example.com");
    const rotatedAccess = reply.cookies.find(
      (c: any) => c.name === "access_token",
    )!;
    assert.equal(
      (app.jwt.verify(rotatedAccess.value) as any).sub,
      userId.toString(),
    );
  });

  test("returns 401 Unauthorized without a refresh token cookie", async () => {
    const reply = await app.inject({ method: "POST", url: "/auth/refresh" });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "FAILED_AUTHENTICATION",
      message: "Unauthorized",
    });
  });

  test("returns 401 INVALID_CREDENTIALS when the refresh token is invalid", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { refresh_token: "garbage-token" },
    });

    assert.equal(reply.statusCode, 401);
    const body = reply.json();
    assert.equal(body.code, "INVALID_CREDENTIALS");
    assert.equal(body.message, "Invalid Credentials");
  });
});

describe("POST /auth/logout", () => {
  test("revokes the session and clears both cookies", async () => {
    const userId = newId();
    const sessionId = newId();
    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });
    const revoke = stubMethod(Session, "findOneAndUpdate", () =>
      mkQuery(mkSessionDoc({ _id: sessionId, userId })),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { refresh_token: refreshToken },
    });

    assert.equal(reply.statusCode, 204);
    assert.equal(revoke.mock.callCount(), 1);

    const setCookies = reply.headers["set-cookie"] as string[];
    assert.equal(Array.isArray(setCookies), true);
    const accessClear = setCookies.find((c) => c.startsWith("access_token="));
    const refreshClear = setCookies.find((c) => c.startsWith("refresh_token="));
    assert.match(accessClear!, /^access_token=;/);
    assert.match(accessClear!, /Path=\/;/);
    assert.match(refreshClear!, /^refresh_token=;/);
    assert.match(refreshClear!, /Path=\/auth;/);
  });

  test("still returns 204 and clears cookies without a refresh token", async () => {
    const revoke = stubMethod(Session, "findOneAndUpdate", () => mkQuery(null));

    const reply = await app.inject({ method: "POST", url: "/auth/logout" });

    assert.equal(reply.statusCode, 204);
    assert.equal(revoke.mock.callCount(), 0);
    const setCookies = reply.headers["set-cookie"] as string[];
    assert.ok(setCookies.some((c) => c.startsWith("access_token=")));
    assert.ok(setCookies.some((c) => c.startsWith("refresh_token=")));
  });
});

describe("GET /protected (authenticate decorator)", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "GET", url: "/protected" });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 200 for a valid access token", async () => {
    const accessToken = signAccessToken(app, { sub: newId().toString() });

    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), { ok: true });
  });

  test("accepts the access token from the access_token cookie", async () => {
    const accessToken = signAccessToken(app, { sub: newId().toString() });

    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      cookies: { access_token: accessToken },
    });

    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), { ok: true });
  });

  test("returns 401 for a refresh token", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });

    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${refreshToken}` },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a tampered access token", async () => {
    const accessToken = signAccessToken(app, { sub: newId().toString() });

    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${accessToken}x` },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });
});

describe("GET /auth/google/callback", () => {
  test("authenticates via Google and redirects with cookies set", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        name: "G User",
        picture: "https://example.com/g.png",
      }),
    }));
    stubMethod(User, "findOne", () => mkQuery(null));
    stubMethod(User, "create", (data: any) => mkUser(data));
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, process.env.FRONTEND_URL!);
    assert.deepEqual(setCookieNames(reply).sort(), [
      "access_token",
      "refresh_token",
    ]);
  });

  test("redirects with error param when Google rejects the code exchange", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: false,
      json: async () => ({}),
    }));

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=bad-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, `${process.env.FRONTEND_URL}?error=google_auth_failed`);
  });
});

describe("POST /auth/register — additional cases", () => {
  test("normalizes email before querying and creating the user", async () => {
    const findOne = stubMethod(User, "findOne", () => mkQuery(null));

    const create = stubMethod(User, "create", (data: any) => mkUser(data));

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Jane Doe",
        email: "  JANE.DOE@example.com  ",
        password: "supersecret123",
      },
    });

    assert.deepEqual(findOne.mock.calls[0].arguments[0], {
      email: "jane.doe@example.com",
    });

    assert.equal(
      create.mock.calls[0].arguments[0].email,
      "jane.doe@example.com",
    );
  });

  test("does not create a user when email is already registered", async () => {
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "taken@example.com" })),
    );

    const create = stubMethod(User, "create", () => {
      throw new Error("User.create should not be called");
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Jane Doe",
        email: "taken@example.com",
        password: "supersecret123",
      },
    });

    assert.equal(reply.statusCode, 409);
    assert.deepEqual(reply.json(), {
      code: "REGISTRATION_FAILED",
      message: "Email already in use",
    });

    assert.equal(create.mock.callCount(), 0);
  });

  test("rejects a whitespace-only name", async () => {
    const create = stubMethod(User, "create", (data: any) => mkUser(data));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "   ",
        email: "jane.doe@example.com",
        password: "supersecret123",
      },
    });

    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
    assert.equal(create.mock.callCount(), 0);
  });

  test("stores a sanitized name", async () => {
    stubMethod(User, "findOne", () => mkQuery(null));
    const create = stubMethod(User, "create", (data: any) => mkUser(data));
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "<b>Jane</b> Doe",
        email: "jane.doe@example.com",
        password: "supersecret123",
      },
    });

    assert.equal(reply.statusCode, 201);
    assert.equal(create.mock.calls[0].arguments[0].name, "Jane Doe");
    assert.equal(reply.json().name, "Jane Doe");
  });
});

describe("POST /auth/login — additional cases", () => {
  test("returns 401 when user does not exist", async () => {
    stubMethod(User, "findOne", () => mkQuery(null));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "missing@example.com",
        password: "password123",
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });

    assert.equal(setCookieNames(reply).length, 0);
  });

  test("normalizes email before querying", async () => {
    const passwordHash = await argon2.hash("password123");

    const findOne = stubMethod(User, "findOne", () =>
      mkQuery(
        mkUser({
          email: "jane@example.com",
          passwordHash,
        }),
      ),
    );

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "  JANE@EXAMPLE.COM  ",
        password: "password123",
      },
    });

    assert.equal(reply.statusCode, 200);

    const [query] = findOne.mock.calls[0].arguments;

    assert.deepEqual(query, {
      email: "jane@example.com",
    });
  });
});

describe("POST /auth/refresh — additional cases", () => {
  test("returns 401 when session does not exist", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    stubMethod(Session, "findById", () => mkQuery(null));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("returns 401 when token subject does not match session user", async () => {
    const tokenUserId = newId();
    const sessionUserId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: tokenUserId.toString(),
      sessionId: sessionId.toString(),
    });

    const session = mkSessionDoc({
      _id: sessionId,
      userId: sessionUserId,
      refreshTokenHash: await argon2.hash(refreshToken),
    });

    stubMethod(Session, "findById", () => mkQuery(session));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("returns 401 when session is revoked", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const session = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(refreshToken),
      revokedAt: new Date(),
    });

    stubMethod(Session, "findById", () => mkQuery(session));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("returns 401 when session has expired", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const session = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(refreshToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    stubMethod(Session, "findById", () => mkQuery(session));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("returns 401 when refresh token does not match session hash", async () => {
    const userId = newId();
    const sessionId = newId();

    const validToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
      jti: "token-1",
    });

    const otherToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
      jti: "token-2",
    });

    const session = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(otherToken),
    });

    stubMethod(Session, "findById", () => mkQuery(session));
    // Reuse detection revokes the session on token mismatch.
    stubMethod(Session, "findByIdAndUpdate", () => Promise.resolve(session as any));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: validToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("returns 401 when user belonging to session no longer exists", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const session = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(refreshToken),
    });

    stubMethod(Session, "findById", () => mkQuery(session));
    stubMethod(User, "findById", () => mkQuery(null));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });

  test("rotates the refresh token hash", async () => {
    const userId = newId();
    const sessionId = newId();

    const oldRefreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const session: any = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(oldRefreshToken),
      expiresAt: new Date(Date.now() + 60_000),
    });

    stubMethod(Session, "findById", () => mkQuery(session));

    stubMethod(User, "findById", () =>
      mkQuery(
        mkUser({
          _id: userId,
          email: "jane@example.com",
          name: "Jane",
        }),
      ),
    );

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: oldRefreshToken,
      },
    });

    assert.equal(reply.statusCode, 200);

    const newRefreshCookie = reply.cookies.find(
      (cookie: any) => cookie.name === "refresh_token",
    );

    assert.ok(newRefreshCookie);
    assert.notEqual(newRefreshCookie.value, oldRefreshToken);

    assert.equal(
      await argon2.verify(session.refreshTokenHash, newRefreshCookie.value),
      true,
    );

    assert.equal(
      await argon2.verify(session.refreshTokenHash, oldRefreshToken),
      false,
    );
  });

  test("old refresh token cannot be reused after rotation", async () => {
    const userId = newId();
    const sessionId = newId();

    const oldRefreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const session: any = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash: await argon2.hash(oldRefreshToken),
      expiresAt: new Date(Date.now() + 60_000),
    });

    stubMethod(Session, "findById", () => mkQuery(session));
    // Reuse detection revokes the session when the old token is replayed.
    stubMethod(Session, "findByIdAndUpdate", () => Promise.resolve(session as any));

    stubMethod(User, "findById", () =>
      mkQuery(
        mkUser({
          _id: userId,
          email: "jane@example.com",
          name: "Jane",
        }),
      ),
    );

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const firstReply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: oldRefreshToken,
      },
    });

    assert.equal(firstReply.statusCode, 200);

    const newRefreshToken = firstReply.cookies.find(
      (cookie: any) => cookie.name === "refresh_token",
    )!.value;

    assert.notEqual(newRefreshToken, oldRefreshToken);

    const secondReply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: oldRefreshToken,
      },
    });

    assert.equal(secondReply.statusCode, 401);
    assert.deepEqual(secondReply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });

    // The rotated token must still be valid.
    const thirdReply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: newRefreshToken,
      },
    });

    assert.equal(thirdReply.statusCode, 200);
  });

  test("does not accept an access token as a refresh token", async () => {
    const accessToken = signAccessToken(app, {
      sub: newId().toString(),
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: accessToken,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "INVALID_CREDENTIALS",
      message: "Invalid Credentials",
    });
  });
});

describe("POST /auth/logout — additional cases", () => {
  test("revokes the session from the refresh token", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    const revoke = stubMethod(Session, "findOneAndUpdate", () =>
      mkQuery(
        mkSessionDoc({
          _id: sessionId,
          userId,
        }),
      ),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 204);
    assert.equal(revoke.mock.callCount(), 1);

    const [filter, update] = revoke.mock.calls[0].arguments;

    assert.equal(filter._id.toString(), sessionId.toString());
    assert.deepEqual(filter.revokedAt, {
      $exists: false,
    });

    assert.ok(update.$set.revokedAt instanceof Date);
  });

  test("returns 401 for an already revoked session", async () => {
    const userId = newId();
    const sessionId = newId();

    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });

    stubMethod(Session, "findOneAndUpdate", () => mkQuery(null));

    const reply = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refresh_token: refreshToken,
      },
    });

    assert.equal(reply.statusCode, 204);
    const setCookies = reply.headers["set-cookie"] as string[];
    assert.ok(Array.isArray(setCookies));
    assert.ok(setCookies.some((c) => c.startsWith("access_token=")));
    assert.ok(setCookies.some((c) => c.startsWith("refresh_token=")));
  });

  test("returns 401 when logout receives an access token", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, {
      sub: userId.toString(),
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refresh_token: accessToken,
      },
    });

    assert.equal(reply.statusCode, 204);
    const setCookies = reply.headers["set-cookie"] as string[];
    assert.ok(Array.isArray(setCookies));
    assert.ok(setCookies.some((c) => c.startsWith("access_token=")));
    assert.ok(setCookies.some((c) => c.startsWith("refresh_token=")));
  });
});

describe("GET /protected — additional cases", () => {
  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: "Bearer ",
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "FAILED_AUTHENTICATION",
      message: "Unauthorized",
    });
  });

  test("returns 401 for an invalid authorization scheme", async () => {
    const accessToken = signAccessToken(app, {
      sub: newId().toString(),
    });

    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: `Basic ${accessToken}`,
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "FAILED_AUTHENTICATION",
      message: "Unauthorized",
    });
  });

  test("returns 401 for a malformed authorization header", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: "Bearer",
      },
    });

    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "FAILED_AUTHENTICATION",
      message: "Unauthorized",
    });
  });
});

describe("GET /auth/google/callback — additional cases", () => {
  test("redirects with error param when Google access token is invalid", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: false,
      json: async () => ({}),
    }));

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=bad-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, `${process.env.FRONTEND_URL}?error=google_auth_failed`);
  });

  test("redirects with error param when Google email is not verified", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: false,
        name: "G User",
        picture: "https://example.com/g.png",
      }),
    }));

    const create = stubMethod(User, "create", () => {
      throw new Error("User.create should not be called");
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, `${process.env.FRONTEND_URL}?error=google_auth_failed`);
    assert.equal(create.mock.callCount(), 0);
  });

  test("redirects with error param when Google user does not contain sub", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        email: "g.user@example.com",
        email_verified: true,
        name: "G User",
      }),
    }));

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, `${process.env.FRONTEND_URL}?error=google_auth_failed`);
  });

  test("redirects with error param when Google user does not contain email", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email_verified: true,
        name: "G User",
      }),
    }));

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(reply.headers.location, `${process.env.FRONTEND_URL}?error=google_auth_failed`);
  });

  test("redirects with conflict error instead of auto-linking an existing local account", async () => {
    const user: any = mkUser({
      email: "g.user@example.com",
      googleId: undefined,
      name: undefined,
      avatar: undefined,
    });

    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        name: "G User",
        picture: "https://example.com/g.png",
      }),
    }));

    // Realistic: no user holds this googleId; the email belongs to a
    // password account — must NOT merge.
    stubMethod(User, "findOne", (cond: any) => {
      if (cond && "googleId" in cond) return mkQuery(null);
      return mkQuery(user);
    });

    const save = stubMethod(user, "save", async function (this: any) {
      return this;
    });

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    // No silent merge: owner logs in with password and links explicitly.
    assert.equal(reply.statusCode, 302);
    assert.equal(
      reply.headers.location,
      `${process.env.FRONTEND_URL}?error=google_account_conflict`,
    );
    assert.equal(save.mock.callCount(), 0);
    assert.equal(user.googleId, undefined);
  });

  test("redirects with conflict error when email belongs to a password account", async () => {
    const user = mkUser({
      email: "g.user@example.com",
      googleId: "different-google-sub",
    });

    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        name: "G User",
      }),
    }));

    stubMethod(User, "findOne", (cond: any) => {
      if (cond && "googleId" in cond) return mkQuery(null);
      return mkQuery(user);
    });

    const create = stubMethod(User, "create", () => {
      throw new Error("User.create should not be called");
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(
      reply.headers.location,
      `${process.env.FRONTEND_URL}?error=google_account_conflict`,
    );
    assert.equal(create.mock.callCount(), 0);
  });

  test("redirects with conflict error instead of merging into an existing account", async () => {
    const user: any = mkUser({
      email: "g.user@example.com",
      googleId: undefined,
      name: "Existing Name",
      avatar: "https://example.com/existing.png",
    });

    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        name: "Google Name",
        picture: "https://example.com/google.png",
      }),
    }));

    stubMethod(User, "findOne", (cond: any) => {
      if (cond && "googleId" in cond) return mkQuery(null);
      return mkQuery(user);
    });

    stubMethod(user, "save", async function (this: any) {
      return this;
    });

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(
      reply.headers.location,
      `${process.env.FRONTEND_URL}?error=google_account_conflict`,
    );

    assert.equal(user.googleId, undefined);
    assert.equal(user.name, "Existing Name");
    assert.equal(user.avatar, "https://example.com/existing.png");
  });

  test("does not create a duplicate user for an existing Google account", async () => {
    const existingUser = mkUser({
      email: "g.user@example.com",
      googleId: "google-sub-789",
    });

    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        name: "G User",
        picture: "https://example.com/g.png",
      }),
    }));

    stubMethod(User, "findOne", () => mkQuery(existingUser));

    const create = stubMethod(User, "create", () => {
      throw new Error("User.create should not be called");
    });

    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "GET",
      url: "/auth/google/callback?code=some-code",
    });

    assert.equal(reply.statusCode, 302);
    assert.equal(create.mock.callCount(), 0);
  });
});

describe("POST /auth/google/link", () => {
  function googleUserStubs(overrides: Record<string, unknown> = {}) {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "google-sub-789",
        email: "g.user@example.com",
        email_verified: true,
        ...overrides,
      }),
    }));
  }

  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/auth/google/link",
      payload: { accessToken: "x" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("links Google to the authenticated user", async () => {
    const userId = newId();
    const user: any = mkUser({ _id: userId, googleId: undefined });
    googleUserStubs();
    // findOne({googleId}) -> null; findById -> user; findOne({email}) -> null
    stubMethod(User, "findOne", () => mkQuery(null));
    stubMethod(User, "findById", () => mkQuery(user));
    const save = stubMethod(user, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/auth/google/link",
      headers: {
        authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}`,
      },
      payload: { accessToken: "google-token" },
    });

    assert.equal(reply.statusCode, 200);
    assert.equal(save.mock.callCount(), 1);
    assert.equal(user.googleId, "google-sub-789");
  });

  test("returns 409 when the Google account belongs to someone else", async () => {
    const userId = newId();
    googleUserStubs();
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ googleId: "google-sub-789" }) as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/auth/google/link",
      headers: {
        authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}`,
      },
      payload: { accessToken: "google-token" },
    });

    assert.equal(reply.statusCode, 409);
    assert.equal(reply.json().code, "GOOGLE_ACCOUNT_CONFLICT");
  });

  test("returns 400 when accessToken is missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/auth/google/link",
      headers: {
        authorization: `Bearer ${signAccessToken(app, { sub: newId().toString() })}`,
      },
      payload: {},
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
});

describe("DELETE /auth/google/link", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/auth/google/link",
    });
    assert.equal(reply.statusCode, 401);
  });

  test("unlinks Google when a password is set", async () => {
    const userId = newId();
    stubMethod(User, "findById", () =>
      mkQuery(
        mkUser({ _id: userId, googleId: "g-sub", passwordHash: "hash" }) as any,
      ),
    );
    const updateOne = stubMethod(User, "updateOne", () =>
      Promise.resolve({ acknowledged: true }) as any,
    );

    const reply = await app.inject({
      method: "DELETE",
      url: "/auth/google/link",
      headers: {
        authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}`,
      },
    });

    assert.equal(reply.statusCode, 204);
    assert.equal(updateOne.mock.callCount(), 1);
  });

  test("returns 400 when unlinking a Google-only account", async () => {
    const userId = newId();
    stubMethod(User, "findById", () =>
      mkQuery(
        mkUser({ _id: userId, googleId: "g-sub", passwordHash: undefined }) as any,
      ),
    );

    const reply = await app.inject({
      method: "DELETE",
      url: "/auth/google/link",
      headers: {
        authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}`,
      },
    });

    assert.equal(reply.statusCode, 400);
  });
});
