import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profile/profile.model";
import { newId, mkProfile, mkQuery, stubMethod, restoreAllStubs } from "../helpers/stubs.ts";
import { buildApp } from "../helpers/app.ts";
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

// ============================================================
// GET /profile/user/:id — public route (no auth required)
// ============================================================
describe("GET /profile/user/:id", () => {
  test("returns 200 with wrapped profile when found", async () => {
    const userId = newId();
    const mockProfile = mkProfile({ userId });
    // mkQuery already chains .populate()
    stubMethod(Profile, "findOne", () => mkQuery(mockProfile as any));

    const reply = await app.inject({
      method: "GET",
      url: `/profile/user/${userId.toString()}`,
    });

    assert.equal(reply.statusCode, 200);
    assert.ok((reply.json() as any).profile);
  });

  test("returns 404 PROFILE_NOT_FOUND when missing", async () => {
    stubMethod(Profile, "findOne", () => mkQuery(null));

    const reply = await app.inject({
      method: "GET",
      url: `/profile/user/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "PROFILE_NOT_FOUND", message: "Profile not found" });
  });

  test("returns 400 VALIDATION_ERROR for malformed id", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/profile/user/not-an-objectid",
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
      url: `/profile/user/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });
});
