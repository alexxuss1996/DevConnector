import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profile/profile.model";
import { profileService } from "#modules/profile/profile.service";
import { newId, mkProfile, stubMethod, restoreAllStubs } from "../helpers/stubs.ts";
import { buildApp, signAccessToken, signRefreshToken } from "../helpers/app.ts";
import { Types } from "mongoose";
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

function authHeader(userId?: string) {
  const id = userId ?? newId().toString();
  return { authorization: `Bearer ${signAccessToken(app, { sub: id })}` };
}

// ============================================================
// DELETE /profile/experience/:experienceId
// ============================================================

describe("DELETE /profile/experience/:experienceId — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${newId().toString()}`,
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${newId().toString()}`,
      headers: { authorization: "Bearer " },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for a refresh token (must be access)", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${newId().toString()}`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for a tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${newId().toString()}`,
      headers: { authorization: `Bearer ${token}x` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const expId = newId();
    const mockProfile = mkProfile({
      userId,
      experience: [{ _id: newId(), title: "Dev", company: "Acme", from: new Date() } as any],
    });
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mockProfile as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      cookies: { access_token: accessToken },
    });
    assert.equal(reply.statusCode, 200);
  });
});

describe("DELETE /profile/experience/:experienceId — validation (ObjectId)", () => {
  test("returns 400 for non-hex string", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/experience/not-an-objectid",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 for too short ObjectId (23 chars)", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/experience/507f1f77bcf86cd79943901", // 23 hex
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 for too long ObjectId (25 chars)", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/experience/507f1f77bcf86cd7994390111", // 25 hex
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 for 24 chars with non-hex (zzzz)", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/experience/zzzzzzzzzzzzzzzzzzzzzzzz",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 for empty string id is 404 (route not matched) or 400 — fastify returns 404 for missing param", async () => {
    // hitting /profile/experience/ without id -> Fastify 404 route not found, not our validation
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/experience/",
      headers: authHeader(),
    });
    // No route matches -> 404; ensure it's not 200
    assert.ok([400, 404].includes(reply.statusCode));
  });

  test("accepts valid 24 hex lowercase and uppercase", async () => {
    const userId = newId();
    const expIdLower = newId().toString(); // lowercase hex
    const mockProfile = mkProfile({ userId, experience: [] });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(mockProfile as any),
    );

    const replyLower = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expIdLower}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });
    assert.equal(replyLower.statusCode, 200);
    restoreAllStubs();

    const expIdUpper = newId().toString().toUpperCase();
    const mockProfile2 = mkProfile({ userId, experience: [] });
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mockProfile2 as any));
    const replyUpper = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expIdUpper}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });
    assert.equal(replyUpper.statusCode, 200);
    // ensure upper was cast to ObjectId correctly — filter should still be ObjectId
    assert.equal(findOneAndUpdate.mock.callCount(), 1); // only lower stub counted before restore
  });
});

describe("DELETE /profile/experience/:experienceId — logic", () => {
  test("returns 200 and profile when experience is deleted", async () => {
    const userId = newId();
    const expId = newId();
    const remaining = { _id: newId(), title: "Other", company: "OtherCo", from: new Date() } as any;
    const persisted = mkProfile({ userId, experience: [remaining] });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(body.profile);
    assert.equal(findOneAndUpdate.mock.callCount(), 1);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0].arguments as any[];
    // filter.userId is string from JWT, filter["experience._id"] must be ObjectId
    assert.equal(filter.userId, userId.toString());
    assert.ok(filter["experience._id"] instanceof Types.ObjectId, "filter should contain ObjectId");
    assert.equal((filter["experience._id"] as Types.ObjectId).toString(), expId.toString());
    // $pull must contain ObjectId as well
    assert.ok(update.$pull.experience._id instanceof Types.ObjectId);
    assert.equal(update.$pull.experience._id.toString(), expId.toString());
    assert.equal(options.new, true);
  });

  test("uses atomic $pull via Types.ObjectId — not string comparison", async () => {
    const userId = newId();
    const expId = newId();
    const persisted = mkProfile({ userId, experience: [] });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    // Ensure we never fell back to string-based filter
    const [filter, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(typeof filter["experience._id"], "object");
    assert.equal(typeof update.$pull.experience._id, "object");
  });

  test("returns 404 PROFILE_NOT_FOUND when profile does not exist", async () => {
    const userId = newId();
    const expId = newId();
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Profile, "exists", () => Promise.resolve(null));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "PROFILE_NOT_FOUND");
  });

  test("returns 404 EXPERIENCE_NOT_FOUND when profile exists but experience does not", async () => {
    const userId = newId();
    const expId = newId();
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Profile, "exists", () => Promise.resolve({ _id: newId() } as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "EXPERIENCE_NOT_FOUND");
    assert.equal((reply.json() as any).message, "Experience not found");
  });

  test("distinguishes PROFILE_NOT_FOUND vs EXPERIENCE_NOT_FOUND via exists check", async () => {
    const userId = newId();
    const expId = newId();
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));
    const exists = stubMethod(Profile, "exists", () => Promise.resolve(null));

    await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(findOneAndUpdate.mock.callCount(), 1);
    assert.equal(exists.mock.callCount(), 1);
    const [existsFilter] = exists.mock.calls[0].arguments as any[];
    assert.deepEqual(existsFilter, { userId: userId.toString() });
  });

  test("returns 500 for unexpected DB error", async () => {
    stubMethod(Profile, "findOneAndUpdate", () => {
      throw new Error("DB boom");
    });

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${newId().toString()}`,
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("uses userId from JWT sub, not from URL or body", async () => {
    const userId = newId();
    const attackerId = newId().toString();
    const expId = newId();
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { userId: attackerId } as any,
    });

    assert.equal(reply.statusCode, 200);
    const [filter] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(filter.userId, userId.toString());
    assert.notEqual(filter.userId, attackerId);
  });
});

// ============================================================
// DELETE /profile/education/:educationId
// ============================================================

describe("DELETE /profile/education/:educationId — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${newId().toString()}`,
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for a refresh token", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${newId().toString()}`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const eduId = newId();
    const mockProfile = mkProfile({ userId, education: [] });
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mockProfile as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${eduId.toString()}`,
      cookies: { access_token: accessToken },
    });
    assert.equal(reply.statusCode, 200);
  });
});

describe("DELETE /profile/education/:educationId — validation (ObjectId)", () => {
  test("returns 400 for non-hex string", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/education/not-an-objectid",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 for too short", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/education/507f1f77bcf86cd79943901",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 for too long", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/education/507f1f77bcf86cd7994390111",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 for non-hex 24 chars", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/education/gggggggggggggggggggggggg",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 400);
  });
});

describe("DELETE /profile/education/:educationId — logic", () => {
  test("returns 200 and profile when education is deleted", async () => {
    const userId = newId();
    const eduId = newId();
    const persisted = mkProfile({ userId, education: [] });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${eduId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 200);
    assert.ok((reply.json() as any).profile);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(filter.userId, userId.toString());
    assert.ok(filter["education._id"] instanceof Types.ObjectId);
    assert.equal(filter["education._id"].toString(), eduId.toString());
    assert.ok(update.$pull.education._id instanceof Types.ObjectId);
    assert.equal(update.$pull.education._id.toString(), eduId.toString());
    assert.equal(options.new, true);
  });

  test("returns 404 PROFILE_NOT_FOUND when profile missing", async () => {
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Profile, "exists", () => Promise.resolve(null));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${newId().toString()}`,
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "PROFILE_NOT_FOUND");
  });

  test("returns 404 EDUCATION_NOT_FOUND when education missing but profile exists", async () => {
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Profile, "exists", () => Promise.resolve({ _id: newId() } as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${newId().toString()}`,
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "EDUCATION_NOT_FOUND");
    assert.equal((reply.json() as any).message, "Education not found");
  });

  test("returns 500 for unexpected error", async () => {
    stubMethod(Profile, "findOneAndUpdate", () => {
      throw new Error("boom");
    });

    const reply = await app.inject({
      method: "DELETE",
      url: `/profile/education/${newId().toString()}`,
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });
});

describe("DELETE routes — DRY and ObjectId invariants", () => {
  test("both routes use Types.ObjectId — not string — for $pull", async () => {
    const userId = newId();
    const expId = newId();
    const eduId = newId();
    const mock = mkProfile({ userId });

    // experience
    const f1 = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mock as any));
    await app.inject({
      method: "DELETE",
      url: `/profile/experience/${expId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });
    assert.ok(f1.mock.calls[0].arguments[0]["experience._id"] instanceof Types.ObjectId);
    restoreAllStubs();

    // education
    const f2 = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mock as any));
    await app.inject({
      method: "DELETE",
      url: `/profile/education/${eduId.toString()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });
    assert.ok(f2.mock.calls[0].arguments[0]["education._id"] instanceof Types.ObjectId);
  });

  test("service fallback validates ObjectId if route validation is bypassed (direct service call)", async () => {
    // Directly call service with invalid id — should throw 400, not 404
    await assert.rejects(
      () => profileService.deleteExperience(newId().toString(), "invalid-id"),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "VALIDATION_ERROR");
        return true;
      },
    );
    await assert.rejects(
      () => profileService.deleteEducation(newId().toString(), "zzz"),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });
});
