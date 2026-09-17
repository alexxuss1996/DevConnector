import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { authService } from "#modules/auth/auth.service";
import User from "#modules/users/user.model";
import Session from "#modules/auth/session.model";
import argon2 from "argon2";
import gravatarUrl from "gravatar-url";
import {
  newId,
  mkUser,
  mkSessionDoc,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "../helpers/stubs.ts";
import { buildApp, signRefreshToken } from "../helpers/app.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
});

after(async () => {
  restoreAllStubs();
  await app.close();
});

afterEach(() => {
  restoreAllStubs();
});

describe("AuthService.register", () => {
  test("registers a user and returns tokens", async () => {
    stubMethod(User, "findOne", () => mkQuery(null));
    const createUser = stubMethod(User, "create", (data: any) =>
      mkUser({
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        avatar: data.avatar,
      }),
    );
    // session document constructed via the service should save without DB
    const sessionSave = stubMethod(
      Session.prototype,
      "save",
      async function (this: any) {
        return this;
      },
    );

    const result = await authService.register(app, {
      name: "Jane Doe",
      email: "Jane.Doe@Example.com",
      password: "supersecret123",
    });

    assert.equal(createUser.mock.callCount(), 1);
    assert.equal(sessionSave.mock.callCount(), 1);
    assert.equal(result.user.email, "jane.doe@example.com");
    assert.equal(result.user.name, "Jane Doe");
    assert.equal(
      result.user.avatar,
      gravatarUrl("jane.doe@example.com", {
        size: 200,
        rating: "pg",
        default: "retro",
      }),
    );
    assert.equal(typeof result.accessToken, "string");
    assert.equal(typeof result.refreshToken, "string");
    const access = app.jwt.verify(result.accessToken) as {
      sub: string;
      type: string;
    };
    assert.equal(access.type, "access");
    const refresh = app.jwt.verify(result.refreshToken) as { type: string };
    assert.equal(refresh.type, "refresh");
  });

  test("throws when a user with the email already exists", async () => {
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "existing@example.com" })),
    );
    await assert.rejects(
      () =>
        authService.register(app, {
          name: "Jane Doe",
          email: "existing@example.com",
          password: "supersecret123",
        }),
      (err: any) =>
        err.statusCode === 400 &&
        err.code === "REGISTRATION_FAILED" &&
        /Registration failed/.test(err.message),
    );
  });
});

describe("AuthService.login", () => {
  test("logs in with valid credentials", async () => {
    const password = "a-valid-password";
    const passwordHash = await argon2.hash(password);
    const existingUser = mkUser({
      email: "jane@example.com",
      name: "Jane Doe",
      passwordHash,
    });
    stubMethod(User, "findOne", () => mkQuery(existingUser));
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const result = await authService.login(app, {
      email: "Jane.Example@EMAIL.com",
      password,
    });

    assert.equal(result.user.email, "jane@example.com");
    assert.equal(result.user.name, "Jane Doe");
    assert.equal(typeof result.accessToken, "string");
    assert.equal(typeof result.refreshToken, "string");
  });

  test("throws when user is not found", async () => {
    stubMethod(User, "findOne", () => mkQuery(null));
    await assert.rejects(
      () =>
        authService.login(app, {
          email: "nope@example.com",
          password: "password123",
        }),
      /Invalid Credentials/,
    );
  });

  test("throws when the password is incorrect", async () => {
    const passwordHash = await argon2.hash("correct-password");
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "jane@example.com", passwordHash })),
    );

    await assert.rejects(
      () =>
        authService.login(app, {
          email: "jane@example.com",
          password: "wrong-password",
        }),
      /Invalid Credentials/,
    );
  });

  test("throws 401 when user has no passwordHash (google-only account)", async () => {
    stubMethod(User, "findOne", () =>
      mkQuery(mkUser({ email: "google@example.com" })),
    );

    await assert.rejects(
      () =>
        authService.login(app, {
          email: "google@example.com",
          password: "password123",
        }),
      (err: any) =>
        err.statusCode === 401 &&
        err.code === "INVALID_CREDENTIALS" &&
        /Invalid Credentials/.test(err.message),
    );
  });

  test("normalizes (lowercases + trims) the email before lookup", async () => {
    const passwordHash = await argon2.hash("password123");
    const existingUser = mkUser({ email: "jane@example.com", passwordHash });
    const findOne = stubMethod(User, "findOne", () => mkQuery(existingUser));
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    await authService.login(app, {
      email: "  JANE@Example.COM  ",
      password: "password123",
    });

    const query = findOne.mock.calls[0]?.arguments[0];
    assert.deepEqual(query, { email: "jane@example.com" });
  });
});

describe("AuthService.refresh", () => {
  async function buildSessionAndToken(
    sessionOverrides: Record<string, unknown> = {},
  ) {
    const userId = newId();
    const sessionId = newId();
    const refreshToken = app.jwt.sign(
      {
        sub: userId.toString(),
        type: "refresh",
        sessionId: sessionId.toString(),
      },
      { expiresIn: "30d" },
    );
    const refreshTokenHash = await argon2.hash(refreshToken);
    const session: any = mkSessionDoc({
      _id: sessionId,
      userId,
      refreshTokenHash,
      ...sessionOverrides,
    });
    return { refreshToken, session, userId };
  }

  test("rotates tokens on a valid refresh", async () => {
    const { refreshToken, session, userId } = await buildSessionAndToken();
    const findById = stubMethod(Session, "findById", () => mkQuery(session));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, email: "jane@example.com", name: "Jane" })),
    );

    const result = await authService.refresh(app, refreshToken);

    assert.equal(findById.mock.callCount(), 1);
    assert.equal(result.user.email, "jane@example.com");
    assert.equal(typeof result.accessToken, "string");
    assert.equal(typeof result.refreshToken, "string");
    const access = app.jwt.verify(result.accessToken) as { type: string };
    assert.equal(access.type, "access");
    const rotated = app.jwt.verify(result.refreshToken) as {
      type: string;
      sessionId: string;
    };
    assert.equal(rotated.type, "refresh");
    assert.equal(rotated.sessionId, session._id.toString());
  });

  test("replaces the stored refresh token hash during rotation", async () => {
    const { refreshToken, session, userId } = await buildSessionAndToken();

    const oldHash = session.refreshTokenHash;

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

    const result = await authService.refresh(app, refreshToken);

    assert.notEqual(session.refreshTokenHash, oldHash);

    assert.equal(
      await argon2.verify(session.refreshTokenHash, result.refreshToken),
      true,
    );
  });

  test("throws for an invalid (garbage) token", async () => {
    await assert.rejects(
      () => authService.refresh(app, "garbage-token"),
      /Invalid Credentials/,
    );
  });

  test("throws when the token is an access token instead of a refresh token", async () => {
    const accessToken = app.jwt.sign(
      { sub: newId().toString(), type: "access" },
      { expiresIn: "15m" },
    );
    await assert.rejects(
      () => authService.refresh(app, accessToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the session no longer exists", async () => {
    const { refreshToken } = await buildSessionAndToken();
    stubMethod(Session, "findById", () => mkQuery(null));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the session userId does not match the token", async () => {
    const { refreshToken, session } = await buildSessionAndToken();
    session.userId = newId(); // different user
    stubMethod(Session, "findById", () => mkQuery(session));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the session has been revoked", async () => {
    const { refreshToken, session } = await buildSessionAndToken({
      revokedAt: new Date(),
    });
    stubMethod(Session, "findById", () => mkQuery(session));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the session has expired", async () => {
    const { refreshToken, session } = await buildSessionAndToken({
      expiresAt: new Date(Date.now() - 1000),
    });
    stubMethod(Session, "findById", () => mkQuery(session));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the refresh token hash does not match", async () => {
    const { refreshToken, session } = await buildSessionAndToken();
    session.refreshTokenHash = await argon2.hash(
      "a-completely-different-token",
    );
    stubMethod(Session, "findById", () => mkQuery(session));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the user is gone", async () => {
    const { refreshToken, session } = await buildSessionAndToken();
    stubMethod(Session, "findById", () => mkQuery(session));
    stubMethod(User, "findById", () => mkQuery(null));

    await assert.rejects(
      () => authService.refresh(app, refreshToken),
      /Invalid Credentials/,
    );
  });
});

describe("AuthService.logout", () => {
  test("revokes the session on a valid refresh token", async () => {
    const userId = newId();
    const sessionId = newId();
    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });
    const session = mkSessionDoc({ _id: sessionId, userId });
    const revoke = stubMethod(Session, "findOneAndUpdate", () =>
      mkQuery(session),
    );

    await authService.logout(app, refreshToken);

    assert.equal(revoke.mock.callCount(), 1);
    const filter = revoke.mock.calls[0]?.arguments[0];
    assert.equal(filter._id, sessionId.toString());
    assert.deepEqual(filter.revokedAt, { $exists: false });
  });

  test("throws for an invalid (garbage) token", async () => {
    await assert.rejects(
      () => authService.logout(app, "garbage-token"),
      /Invalid Credentials/,
    );
  });

  test("throws when the session cannot be found", async () => {
    const userId = newId();
    const sessionId = newId();
    const refreshToken = signRefreshToken(app, {
      sub: userId.toString(),
      sessionId: sessionId.toString(),
    });
    stubMethod(Session, "findOneAndUpdate", () => mkQuery(null));

    await assert.rejects(
      () => authService.logout(app, refreshToken),
      /Invalid Credentials/,
    );
  });

  test("throws when the token is an access token", async () => {
    const accessToken = app.jwt.sign(
      { sub: newId().toString(), type: "access" },
      { expiresIn: "15m" },
    );
    await assert.rejects(
      () => authService.logout(app, accessToken),
      /Invalid Credentials/,
    );
  });
});

describe("AuthService.authenticateGoogle", () => {
  afterEach(() => {
    restoreAllStubs();
  });

  test("creates a new user from a verified Google account", async () => {
    const googleSub = "google-sub-123";
    const googleUser = {
      sub: googleSub,
      email: "newuser@example.com",
      email_verified: true,
      name: "New User",
      picture: "https://example.com/pic.png",
    };
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => googleUser,
    }));
    stubMethod(User, "findOne", () => mkQuery(null));
    const create = stubMethod(User, "create", (data: any) =>
      mkUser({
        name: data.name,
        email: data.email,
        googleId: data.googleId,
        avatar: data.avatar,
      }),
    );
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const result = await authService.authenticateGoogle(
      app,
      "google-access-token",
    );

    assert.equal(create.mock.callCount(), 1);
    assert.equal(result.user.email, "newuser@example.com");
    assert.equal(result.user.name, "New User");
    assert.equal(result.user.avatar, "https://example.com/pic.png");
    const refresh = app.jwt.verify(result.refreshToken) as {
      sub: string;
      type: string;
    };
    assert.equal(refresh.type, "refresh");
  });

  test("links an existing email user to the Google account", async () => {
    const googleUser = {
      sub: "google-sub-456",
      email: "existing@example.com",
      email_verified: true,
      name: "Existing User",
      picture: "https://example.com/old.png",
    };
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => googleUser,
    }));
    const existingUser = mkUser({
      email: "existing@example.com",
      name: "Existing",
      avatar: "https://example.com/old.png",
    });
    // First findOne (by googleId) -> null; second (by email) -> existing user
    stubMethod(User, "findOne", (cond: any) => {
      if (cond && "googleId" in cond) return mkQuery(null);
      return mkQuery(existingUser);
    });
    stubMethod(Session.prototype, "save", async function (this: any) {
      return this;
    });

    const result = await authService.authenticateGoogle(
      app,
      "google-access-token",
    );

    assert.equal(existingUser.save.mock.callCount(), 1);
    assert.equal(existingUser.googleId, "google-sub-456");
    assert.equal(existingUser.name, "Existing");
    assert.equal(existingUser.avatar, "https://example.com/old.png");
    assert.equal(result.user.email, "existing@example.com");
  });

  test("throws when the Google email is not verified", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        sub: "s",
        email: "u@example.com",
        email_verified: false,
      }),
    }));
    await assert.rejects(
      () => authService.authenticateGoogle(app, "token"),
      /Google Email is not verified/,
    );
  });

  test("throws when the Google user payload is invalid", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ sub: "s", email_verified: true }),
    }));
    await assert.rejects(
      () => authService.authenticateGoogle(app, "token"),
      /Google User is invalid/,
    );
  });

  test("throws when the Google access token is rejected", async () => {
    stubMethod(globalThis, "fetch", async () => ({
      ok: false,
      json: async () => ({}),
    }));
    await assert.rejects(
      () => authService.authenticateGoogle(app, "bad-token"),
      (err: any) =>
        err.statusCode === 401 &&
        err.code === "GOOGLE_AUTH_FAILED" &&
        /Invalid Google access token/.test(err.message),
    );
  });

  test("throws 409 when the Google account is already linked to another user", async () => {
    const googleUser = {
      sub: "different-sub",
      email: "taken@example.com",
      email_verified: true,
      name: "Taken",
      picture: "https://example.com/x.png",
    };
    stubMethod(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => googleUser,
    }));
    stubMethod(User, "findOne", (cond: any) => {
      // First lookup is by googleId (returns null), second by email (existing user)
      if (cond && "googleId" in cond) return mkQuery(null);
      return mkQuery(
        mkUser({
          email: "taken@example.com",
          googleId: "another-google-sub",
        }),
      );
    });

    await assert.rejects(
      () => authService.authenticateGoogle(app, "token"),
      (err: any) =>
        err.statusCode === 409 &&
        err.code === "GOOGLE_ACCOUNT_CONFLICT" &&
        /Google account is already linked/.test(err.message),
    );
  });
});
