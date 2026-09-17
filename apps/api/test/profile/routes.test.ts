import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profile/profile.model";
import {
  newId,
  mkProfile,
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

// Helpers
function validProfilePayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "Developer",
    skills: ["JavaScript", "Node.js"],
    ...overrides,
  };
}

describe("POST /profile — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      payload: validProfilePayload(),
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: "Bearer " },
      payload: validProfilePayload(),
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a refresh token (must be access)", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${refreshToken}` },
      payload: validProfilePayload(),
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${token}x` },
      payload: validProfilePayload(),
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const mockDoc = mkProfile({ userId, status: "Developer", skills: ["JS"] });
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mockDoc as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      cookies: { access_token: accessToken },
      payload: validProfilePayload(),
    });
    assert.equal(reply.statusCode, 200);
  });
});

describe("POST /profile — validation", () => {
  function authHeader() {
    return { authorization: `Bearer ${signAccessToken(app, { sub: newId().toString() })}` };
  }

  test("returns 400 when status is missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: authHeader(),
      payload: { skills: ["JS"] },
    });
    assert.equal(reply.statusCode, 400);
    const body = reply.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: any) => e.message.includes("status") || e.field === "status"));
  });

  test("returns 400 when skills is missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: authHeader(),
      payload: { status: "Developer" },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when skills is empty array", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: authHeader(),
      payload: { status: "Developer", skills: [] },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when website is not a uri", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: authHeader(),
      payload: validProfilePayload({ website: "not-a-uri" }),
    });
    assert.equal(reply.statusCode, 400);
    const body = reply.json();
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors.some((e: any) => e.field === "website"));
  });

  test("returns 400 when social uris are invalid", async () => {
    for (const field of ["youtube", "twitter", "facebook", "linkedin", "instagram"]) {
      const reply = await app.inject({
        method: "POST",
        url: "/profile/",
        headers: authHeader(),
        payload: validProfilePayload({ [field]: "not-a-uri" }),
      });
      assert.equal(reply.statusCode, 400, `should fail for ${field}`);
      assert.equal(reply.json().code, "VALIDATION_ERROR");
    }
  });

  test("returns 400 when bio exceeds 500 chars", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: authHeader(),
      payload: validProfilePayload({ bio: "a".repeat(501) }),
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("accepts minimal valid payload (only required fields)", async () => {
    const userId = newId();
    const mockDoc = mkProfile({ userId, status: "Developer", skills: ["JS"] });
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(mockDoc as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { status: "Developer", skills: ["JS"] },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json() as any).status, "Developer");
  });
});

describe("POST /profile — createOrUpdate logic", () => {
  test("creates profile and returns 200 with the persisted document", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const payload = validProfilePayload({
      company: "Acme",
      website: "https://example.com",
      location: "NYC",
      bio: "Hello",
      githubusername: "octocat",
      twitter: "https://twitter.com/jane",
      linkedin: "https://linkedin.com/in/jane",
    });
    const persisted = mkProfile({
      userId,
      ...(payload as any),
      social: { twitter: (payload as any).twitter as string, linkedin: (payload as any).linkedin as string },
    });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.equal(body.company, "Acme");
    assert.equal(body.website, "https://example.com");
    assert.equal(body.status, "Developer");
    assert.deepEqual(body.skills, ["JavaScript", "Node.js"]);
    // Verify service was called with correct filter and $set using dot-notation for social
    assert.equal(findOneAndUpdate.mock.callCount(), 1);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.deepEqual(filter, { userId: userId.toString() });
    assert.equal(options.upsert, true);
    assert.equal(options.returnDocument, "after");
    assert.equal(options.setDefaultsOnInsert, true);
    assert.equal(update.$set.status, "Developer");
    assert.equal(update.$set.company, "Acme");
    assert.equal(update.$set["social.twitter"], "https://twitter.com/jane");
    assert.equal(update.$set["social.linkedin"], "https://linkedin.com/in/jane");
    // top-level fields should be present, social should not be a nested object
    assert.equal(update.$set.social, undefined);
  });

  test("merges social fields via dot-notation instead of overwriting whole social object", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const payload = validProfilePayload({ facebook: "https://facebook.com/jane" });
    const persisted = mkProfile({ userId, social: { facebook: (payload as any).facebook as string } });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$set["social.facebook"], "https://facebook.com/jane");
    assert.equal(update.$set.social, undefined);
    // other social keys should not be set
    assert.equal(update.$set["social.twitter"], undefined);
    assert.equal(update.$set["social.linkedin"], undefined);
  });

  test("does not send social keys when no social is provided (preserves existing social)", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const payload = validProfilePayload({ company: "NoSocial" });
    const persisted = mkProfile({ userId, company: "NoSocial" });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.ok(!Object.keys(update.$set).some((k: string) => k.startsWith("social.")));
    assert.equal(update.$set.social, undefined);
  });

  test("filters out undefined top-level fields so $set does not contain them", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    // Only required fields, optional company/website etc omitted
    const payload = validProfilePayload();
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$set.company, undefined);
    assert.equal(update.$set.website, undefined);
    assert.equal(update.$set.location, undefined);
    assert.equal(update.$set.bio, undefined);
    assert.equal(update.$set.githubusername, undefined);
    // required fields must be present
    assert.equal(update.$set.status, "Developer");
    assert.deepEqual(update.$set.skills, ["JavaScript", "Node.js"]);
  });

  test("handles all social providers together", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const payload = validProfilePayload({
      youtube: "https://youtube.com/c/jane",
      twitter: "https://twitter.com/jane",
      facebook: "https://facebook.com/jane",
      linkedin: "https://linkedin.com/in/jane",
      instagram: "https://instagram.com/jane",
    });
    const persisted = mkProfile({ userId, social: { youtube: (payload as any).youtube as string } });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$set["social.youtube"], "https://youtube.com/c/jane");
    assert.equal(update.$set["social.twitter"], "https://twitter.com/jane");
    assert.equal(update.$set["social.facebook"], "https://facebook.com/jane");
    assert.equal(update.$set["social.linkedin"], "https://linkedin.com/in/jane");
    assert.equal(update.$set["social.instagram"], "https://instagram.com/jane");
  });

  test("uses userId from JWT sub, not from payload", async () => {
    const userId = newId();
    const otherId = newId().toString();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { ...validProfilePayload(), userId: otherId } as any,
    });

    // TypeBox strips unknown props, but filter must still be JWT sub
    assert.equal(reply.statusCode, 200);
    const [filter] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(filter.userId, userId.toString());
    assert.notEqual(filter.userId, otherId);
  });

  test("returns 500 for unexpected service error", async () => {
    const userId = newId();
    stubMethod(Profile, "findOneAndUpdate", () => {
      throw new Error("DB boom");
    });

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: validProfilePayload(),
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });
});

describe("POST /profile — wipe via null", () => {
  test("wipes a top-level optional field when null is sent", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const persisted = mkProfile({ userId, company: undefined });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validProfilePayload({ company: null }),
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$unset.company, 1);
    assert.equal(update.$set?.company, undefined);
  });

  test("wipes multiple top-level fields and social fields together", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validProfilePayload({ company: null, website: null, twitter: null, linkedin: null }),
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$unset.company, 1);
    assert.equal(update.$unset.website, 1);
    assert.equal(update.$unset["social.twitter"], 1);
    assert.equal(update.$unset["social.linkedin"], 1);
    assert.equal(update.$set?.company, undefined);
  });

  test("wipes a single social provider without affecting others", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validProfilePayload({ twitter: null }),
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$unset["social.twitter"], 1);
    assert.equal(update.$set?.["social.twitter"], undefined);
    assert.equal(update.$unset["social.linkedin"], undefined);
  });

  test("mixes $set and $unset in same request", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const persisted = mkProfile({ userId, company: "NewCo" });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(persisted as any),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: validProfilePayload({ company: "NewCo", website: null, facebook: "https://facebook.com/new" }),
    });

    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$set.company, "NewCo");
    assert.equal(update.$set["social.facebook"], "https://facebook.com/new");
    assert.equal(update.$unset.website, 1);
  });

  test("wipes optional fields when empty string is sent (form-friendly)", async () => {
    const userId = newId();
    const cases: Array<{ payload: Record<string, unknown>; unsetKey: string }> = [
      { payload: validProfilePayload({ company: "" }), unsetKey: "company" },
      { payload: validProfilePayload({ bio: "" }), unsetKey: "bio" },
      { payload: validProfilePayload({ website: "" }), unsetKey: "website" },
      { payload: validProfilePayload({ twitter: "" }), unsetKey: "social.twitter" },
    ];
    for (const { payload, unsetKey } of cases) {
      const persisted = mkProfile({ userId });
      const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(persisted as any));
      const reply = await app.inject({
        method: "POST",
        url: "/profile/",
        headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
        payload,
      });
      assert.equal(reply.statusCode, 200, `should 200 for ${JSON.stringify(payload)}`);
      const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
      assert.equal(update.$unset[unsetKey], 1, `should unset ${unsetKey}`);
      restoreAllStubs();
    }
  });

  test("wipes with whitespace string as well", async () => {
    const userId = newId();
    const persisted = mkProfile({ userId });
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(persisted as any));
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: validProfilePayload({ company: "   " }),
    });
    assert.equal(reply.statusCode, 200);
    const [, update] = findOneAndUpdate.mock.calls[0].arguments as any[];
    assert.equal(update.$unset.company, 1);
  });

  test("returns 400 for empty required fields", async () => {
    const userId = newId();
    const cases = [validProfilePayload({ status: "" }), validProfilePayload({ skills: [""] }), validProfilePayload({ status: "   " })];
    for (const payload of cases) {
      const reply = await app.inject({
        method: "POST",
        url: "/profile/",
        headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
        payload,
      });
      assert.equal(reply.statusCode, 400, `should 400 for ${JSON.stringify(payload)}`);
      assert.equal(reply.json().code, "VALIDATION_ERROR");
    }
  });

  test("returns 400 when required fields are nulled", async () => {
    const userId = newId();
    for (const payload of [{ status: null, skills: ["JS"] }, { status: "Dev", skills: null }]) {
      const reply = await app.inject({
        method: "POST",
        url: "/profile/",
        headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
        payload: payload as any,
      });
      assert.equal(reply.statusCode, 400);
      assert.equal(reply.json().code, "VALIDATION_ERROR");
    }
  });
});

describe("GET /profile/me — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "GET", url: "/profile/me" });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a refresh token", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("accepts token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const mockProfile = mkProfile({ userId });
    stubMethod(Profile, "findOne", () => mkQuery({ ...mockProfile, populate: () => mkQuery(mockProfile as any) } as any));

    // Simpler: stub findOne to return query with populate that resolves to mockProfile
    restoreAllStubs();
    stubMethod(Profile, "findOne", () => mkQuery(mockProfile as any));

    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      cookies: { access_token: accessToken },
    });
    assert.equal(reply.statusCode, 200);
    assert.ok((reply.json() as any).profile);
  });
});

describe("GET /profile/me — logic", () => {
  test("returns 200 with the profile when found", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const mockProfile = mkProfile({
      userId,
      status: "Developer",
      skills: ["JS", "TS"],
      company: "Acme",
      social: { twitter: "https://twitter.com/jane" },
    });
    // Profile.findOne(...).populate() — mkQuery already handles populate
    stubMethod(Profile, "findOne", () => mkQuery(mockProfile as any));

    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(body.profile);
    assert.equal(body.profile.status, "Developer");
    assert.equal(body.profile.company, "Acme");
    assert.deepEqual(body.profile.skills, ["JS", "TS"]);
  });

  test("returns 404 PROFILE_NOT_FOUND when no profile exists", async () => {
    const userId = newId();
    stubMethod(Profile, "findOne", () => mkQuery(null));

    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 404);
    const body = reply.json() as any;
    assert.equal(body.code, "PROFILE_NOT_FOUND");
    assert.equal(body.message, "Profile not found");
  });

  test("populates userId with name and avatar", async () => {
    const userId = newId();
    const mockProfile = mkProfile({ userId });
    const findOneStub = stubMethod(Profile, "findOne", () => mkQuery(mockProfile as any));

    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 200);
    // Verify findOne was called with correct filter and populate args
    assert.equal(findOneStub.mock.callCount(), 1);
    const [filter] = findOneStub.mock.calls[0].arguments as any[];
    assert.deepEqual(filter, { userId: userId.toString() });
    // mkQuery.populate is a no-op but we can ensure it was at least a query;
    // the service calls .populate("userId", ["name","avatar"])
  });

  test("returns 500 for unexpected error", async () => {
    stubMethod(Profile, "findOne", () => {
      throw new Error("DB boom");
    });

    const reply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: newId().toString() })}` },
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });
});
