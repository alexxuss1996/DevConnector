import { describe, test, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profile/profile.model";
import User from "#modules/users/user.model";
import Post from "#modules/posts/posts.model";
import Session from "#modules/auth/session.model";
import { profileService } from "#modules/profile/profile.service";
import { newId, mkProfile, mkQuery, stubMethod, restoreAllStubs } from "../helpers/stubs.ts";
import { buildApp, signAccessToken, signRefreshToken } from "../helpers/app.ts";
import mongoose, { Types } from "mongoose";
import type { FastifyInstance } from "fastify";

function stubMongooseSession() {
  let inTxn = false;
  const session: any = {
    startTransaction: mock.fn(() => {
      inTxn = true;
    }),
    abortTransaction: mock.fn(async () => {
      inTxn = false;
    }),
    commitTransaction: mock.fn(async () => {
      inTxn = false;
    }),
    endSession: mock.fn(async () => {}),
    inTransaction: mock.fn(() => inTxn),
  };
  stubMethod(mongoose as any, "startSession", async () => session);
  return session;
}

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

function mkSavableProfile(overrides: any = {}) {
  const base = mkProfile(overrides);
  return {
    ...base,
    save: mock.fn(async function (this: any) {
      return this;
    }),
  } as any;
}

// ============================================================
// createOrUpdateProfile — uncovered branches
// ============================================================
describe("createOrUpdateProfile — uncovered branches", () => {
  test("returns existing profile when update is empty (76-78)", async () => {
    const userId = newId().toString();
    const existing = mkProfile({ userId: new Types.ObjectId(userId) as any });
    // Force empty update by calling service directly with {} (bypasses route validation)
    // to hit if (!Object.keys(update).length) branch
    stubMethod(Profile, "findOne", () => mkQuery(existing as any));
    // findOneAndUpdate should NOT be called if existing found
    const spy = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null as any));

    const result = await profileService.createOrUpdateProfile(userId, {} as any);
    assert.deepEqual(result, existing.toJSON());
    assert.equal(spy.mock.callCount(), 0);
  });

  test("throws 500 when upsert returns null (90-92)", async () => {
    const userId = newId().toString();
    // empty update + no existing -> proceeds to findOneAndUpdate which returns null
    stubMethod(Profile, "findOne", () => mkQuery(null));
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(null));

    await assert.rejects(
      () => profileService.createOrUpdateProfile(userId, {} as any),
      (err: any) => {
        assert.equal(err.statusCode, 500);
        assert.equal(err.code, "INTERNAL_SERVER_ERROR");
        return true;
      },
    );
  });

  test("empty update without existing proceeds to upsert and can fail validation (indirect)", async () => {
    const userId = newId().toString();
    const persisted = mkProfile({ userId: new Types.ObjectId(userId) as any });
    stubMethod(Profile, "findOne", () => mkQuery(null));
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(persisted as any));

    // {} will have empty update, no existing, so it will call findOneAndUpdate
    // With persisted returned, it should succeed (runValidators mocked)
    const result = await profileService.createOrUpdateProfile(userId, {} as any);
    assert.ok(result);
  });

  test("covers required-field preserve branch (48) — status/skills null are ignored via direct service call", async () => {
    const userId = newId().toString();
    // status = "" should be skipped (continue) not added to $unset, skills = null also skipped
    const persisted = mkProfile({ userId: new Types.ObjectId(userId) as any, status: "Developer", skills: ["JS"] });
    const spy = stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(persisted as any));

    // bypass route validation via direct service call
    const result = await profileService.createOrUpdateProfile(userId, {
      status: "   " as any, // whitespace triggers trim==="" branch, then continue for status
      skills: null as any, // null triggers branch, then continue for skills
      company: "Acme",
    } as any);

    assert.ok(result);
    const [, update] = spy.mock.calls[0].arguments as any[];
    // status/skills must NOT be in $unset, and must NOT be in $set as empty
    assert.equal(update.$unset?.status, undefined);
    assert.equal(update.$unset?.skills, undefined);
    // company should be in $set
    assert.equal(update.$set.company, "Acme");
    // status/skills also not in $set (since they were skipped)
    assert.equal(update.$set.status, undefined);
    assert.equal(update.$set.skills, undefined);
  });
});



// ============================================================
// GET /profile/ — uncovered 21-24
// ============================================================
describe("GET /profile/ — uncovered", () => {
  test("returns 200 with profiles array (public, no auth required)", async () => {
    const p1 = mkProfile({ status: "Dev", skills: ["JS"] });
    const p2 = mkProfile({ status: "Manager", skills: ["Leadership"] });
    // Profile.find().populate() chain — stub find to return query that resolves to array
    // Our service does Profile.find().populate(...)
    // mkQuery for array needs to support populate chain; mkQuery already does
    stubMethod(Profile, "find", () => mkQuery([p1, p2] as any));

    const reply = await app.inject({ method: "GET", url: "/profile/" });
    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(Array.isArray(body.profiles));
    assert.equal(body.profiles.length, 2);
  });

  test("returns 200 with empty array when no profiles", async () => {
    stubMethod(Profile, "find", () => mkQuery([] as any));
    const reply = await app.inject({ method: "GET", url: "/profile/" });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual((reply.json() as any).profiles, []);
  });

  test("returns 500 on DB error", async () => {
    stubMethod(Profile, "find", () => {
      throw new Error("DB boom");
    });
    const reply = await app.inject({ method: "GET", url: "/profile/" });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });
});

// ============================================================
// DELETE /profile/ — uncovered 32-35 (and service 96-106)
// ============================================================
describe("DELETE /profile/ — authentication and logic", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({ method: "DELETE", url: "/profile/" });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for refresh token", async () => {
    const refresh = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      headers: { authorization: `Bearer ${refresh}` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts cookie token", async () => {
    stubMongooseSession();
    const userId = newId();
    const token = signAccessToken(app, { sub: userId.toString() });
    const prof = mkProfile({ userId });
    const usr = { _id: userId } as any;
    stubMethod(Profile, "findOneAndDelete", () => Promise.resolve(prof as any));
    stubMethod(User, "findOneAndDelete", () => Promise.resolve(usr as any));
    stubMethod(Post, "deleteMany", () => Promise.resolve({ acknowledged: true } as any));
    stubMethod(Post, "updateMany", () => Promise.resolve({ acknowledged: true } as any));
    stubMethod(Session, "deleteMany", () => Promise.resolve({ acknowledged: true } as any));

    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      cookies: { access_token: token },
    });
    assert.equal(reply.statusCode, 204);
  });

  test("returns 404 PROFILE_NOT_FOUND when profile missing", async () => {
    stubMongooseSession();
    stubMethod(Profile, "findOneAndDelete", () => Promise.resolve(null));
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "PROFILE_NOT_FOUND");
  });

  test("returns 404 when profile deleted but user missing (96-106 second branch)", async () => {
    stubMongooseSession();
    const prof = mkProfile({});
    stubMethod(Profile, "findOneAndDelete", () => Promise.resolve(prof as any));
    stubMethod(User, "findOneAndDelete", () => Promise.resolve(null));

    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "PROFILE_NOT_FOUND");
  });

  test("returns 204 on success and deletes both", async () => {
    const session = stubMongooseSession();
    const userId = newId();
    const prof = mkProfile({ userId });
    const usr = { _id: userId } as any;
    const delProfile = stubMethod(Profile, "findOneAndDelete", () => Promise.resolve(prof as any));
    const delUser = stubMethod(User, "findOneAndDelete", () => Promise.resolve(usr as any));
    stubMethod(Post, "deleteMany", () => Promise.resolve({ acknowledged: true } as any));
    stubMethod(Post, "updateMany", () => Promise.resolve({ acknowledged: true } as any));
    stubMethod(Session, "deleteMany", () => Promise.resolve({ acknowledged: true } as any));

    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });
    assert.equal(reply.statusCode, 204);
    // body is empty for 204 but our handler sends {message}
    // fastify 204 strips body, so json parse may be empty — just check filter
    assert.equal(delProfile.mock.callCount(), 1);
    const [pFilter] = delProfile.mock.calls[0].arguments as any[];
    assert.deepEqual(pFilter, { userId: userId.toString() });
    assert.equal(delUser.mock.callCount(), 1);
    const [uFilter] = delUser.mock.calls[0].arguments as any[];
    assert.deepEqual(uFilter, { _id: userId.toString() });
    // Verify transaction was used: session passed to both operations and committed
    assert.equal(delProfile.mock.calls[0].arguments[1]?.session, session);
    assert.equal(delUser.mock.calls[0].arguments[1]?.session, session);
    assert.equal(session.commitTransaction.mock.callCount(), 1);
    assert.equal(session.endSession.mock.callCount(), 1);
  });

  test("returns 500 on unexpected error", async () => {
    stubMongooseSession();
    stubMethod(Profile, "findOneAndDelete", () => {
      throw new Error("boom");
    });
    const reply = await app.inject({
      method: "DELETE",
      url: "/profile/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// POST /profile/experience — addExperience (108-136)
// ============================================================
describe("POST /profile/experience — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts cookie", async () => {
    const userId = newId();
    const token = signAccessToken(app, { sub: userId.toString() });
    const prof = mkSavableProfile({ userId, experience: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      cookies: { access_token: token },
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 200);
  });
});

describe("POST /profile/experience — validation", () => {
  test("returns 400 when title missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { company: "Acme", from: "2023-01-01" } as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when company missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { title: "Dev", from: "2023-01-01" } as any,
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 when from is not date", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { title: "Dev", company: "Acme", from: "not-a-date" },
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 when to is not date", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { title: "Dev", company: "Acme", from: "2023-01-01", to: "bad-date" },
    });
    assert.equal(reply.statusCode, 400);
  });
});

describe("POST /profile/experience — logic (108-136)", () => {
  test("returns 404 when profile not found", async () => {
    stubMethod(Profile, "findOne", () => mkQuery(null));
    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "PROFILE_NOT_FOUND");
  });

  test("pushes experience with all fields and returns 200 (covers 119-131 save)", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, experience: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const payload = {
      title: "Engineer",
      company: "Acme",
      location: "NYC",
      from: "2023-01-01",
      to: "2023-12-31",
      current: false,
      description: "Did stuff",
    };

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload,
    });
    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(body.profile);
    assert.equal(prof.save.mock.callCount(), 1);
    // experience pushed with Date conversion
    assert.equal(prof.experience.length, 1);
    const exp = prof.experience[0] as any;
    assert.equal(exp.title, "Engineer");
    assert.equal(exp.company, "Acme");
    assert.equal(exp.location, "NYC");
    assert.ok(exp.from instanceof Date);
    assert.ok(exp.to instanceof Date);
    assert.equal(exp.current, false);
    assert.equal(exp.description, "Did stuff");
  });

  test("handles optional fields omitted (to/current undefined)", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, experience: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 200);
    const exp = prof.experience[0] as any;
    assert.equal(exp.title, "Dev");
    assert.equal(exp.to, undefined);
    // schema default injects false for current when omitted
    assert.equal(exp.current, false);
    assert.equal(exp.location, undefined);
  });

  test("handles current=true without to date", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, experience: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { title: "Dev", company: "Acme", from: "2023-01-01", current: true },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal(prof.experience[0].current, true);
    assert.equal(prof.experience[0].to, undefined);
  });

  test("handles null experience array defaults to []", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, experience: null as any });
    // service does profile.experience ?? [] so null yields []
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 200);
  });

  test("returns 500 on save error", async () => {
    const prof = mkSavableProfile({ experience: [] });
    prof.save = mock.fn(async () => {
      throw new Error("save boom");
    });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/experience",
      headers: authHeader(),
      payload: { title: "Dev", company: "Acme", from: "2023-01-01" },
    });
    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// POST /profile/education — addEducation (139-167)
// ============================================================
describe("POST /profile/education — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01" },
    });
    assert.equal(reply.statusCode, 401);
  });
});

describe("POST /profile/education — validation", () => {
  test("returns 400 when school missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { degree: "BS", fieldofstudy: "CS", from: "2020-01-01" } as any,
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 when degree missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { school: "MIT", fieldofstudy: "CS", from: "2020-01-01" } as any,
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 when fieldofstudy missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { school: "MIT", degree: "BS", from: "2020-01-01" } as any,
    });
    assert.equal(reply.statusCode, 400);
  });

  test("returns 400 when from is not date", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "bad" },
    });
    assert.equal(reply.statusCode, 400);
  });
});

describe("POST /profile/education — logic (139-167)", () => {
  test("returns 404 when profile not found", async () => {
    stubMethod(Profile, "findOne", () => mkQuery(null));
    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01" },
    });
    assert.equal(reply.statusCode, 404);
  });

  test("pushes education with all fields and returns 200", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, education: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const payload = {
      school: "MIT",
      degree: "Master",
      fieldofstudy: "CS",
      from: "2020-01-01",
      to: "2022-06-01",
      current: false,
      description: "Thesis",
    };

    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload,
    });
    assert.equal(reply.statusCode, 200);
    const edu = prof.education[0] as any;
    assert.equal(edu.school, "MIT");
    assert.equal(edu.degree, "Master");
    assert.equal(edu.fieldofstudy, "CS");
    assert.ok(edu.from instanceof Date);
    assert.ok(edu.to instanceof Date);
    assert.equal(edu.current, false);
    assert.equal(edu.description, "Thesis");
  });

  test("handles optional to/current omitted", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, education: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01" },
    });
    assert.equal(reply.statusCode, 200);
    const edu = prof.education[0] as any;
    assert.equal(edu.to, undefined);
    // schema default injects false
    assert.equal(edu.current, false);
  });

  test("handles current=true without to", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, education: [] });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01", current: true },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal(prof.education[0].current, true);
  });

  test("handles null education array", async () => {
    const userId = newId();
    const prof = mkSavableProfile({ userId, education: null as any });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01" },
    });
    assert.equal(reply.statusCode, 200);
  });

  test("returns 500 on save error", async () => {
    const prof = mkSavableProfile({ education: [] });
    prof.save = mock.fn(async () => {
      throw new Error("boom");
    });
    stubMethod(Profile, "findOne", () => mkQuery(prof as any));

    const reply = await app.inject({
      method: "POST",
      url: "/profile/education",
      headers: authHeader(),
      payload: { school: "MIT", degree: "BS", fieldofstudy: "CS", from: "2020-01-01" },
    });
    assert.equal(reply.statusCode, 500);
  });
});
