import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profiles/profiles.model";
import { newId, mkProfile, mkQuery, stubMethod, restoreAllStubs } from "../helpers/stubs.ts";
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createApp } from "#app";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = await createApp({
    logger: false,
    overrides: {
      oauth: oauthStub,
      db: noDb,
      // Real per-IP keying, so a suite that fires many requests at one
      // address trips the production budget. Key per request instead; the
      // limits themselves stay real.
      rateLimitKey: () => randomUUID(),
    },
  });
});

after(async () => {
  restoreAllStubs();
  await app.close();
});

afterEach(() => {
  restoreAllStubs();
});

// ============================================================
// GET /profiles/user/:id — public route (no auth required)
// ============================================================
describe("GET /profiles/user/:id", () => {
  test("returns 200 with wrapped profile when found", async () => {
    const userId = newId();
    const mockProfile = mkProfile({ userId });
    // mkQuery already chains .populate()
    stubMethod(Profile, "findOne", () => mkQuery(mockProfile as any));

    const reply = await app.inject({
      method: "GET",
      url: `/profiles/user/${userId.toString()}`,
    });

    assert.equal(reply.statusCode, 200);
    assert.ok((reply.json() as any).profile);
  });

  test("returns 404 PROFILE_NOT_FOUND when missing", async () => {
    stubMethod(Profile, "findOne", () => mkQuery(null));

    const reply = await app.inject({
      method: "GET",
      url: `/profiles/user/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "PROFILE_NOT_FOUND", message: "Profile not found", requestId: reply.json().requestId });
  });

  test("returns 400 VALIDATION_ERROR for malformed id", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/profiles/user/not-an-objectid",
    });

    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 500 for unexpected DB error", async () => {
    stubMethod(Profile, "findOne", () => {
      throw new Error("DB boom");
    });

    const reply = await app.inject({
      method: "GET",
      url: `/profiles/user/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error", requestId: reply.json().requestId });
  });
});
