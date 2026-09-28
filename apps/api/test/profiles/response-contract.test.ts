import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

import Profile from "#modules/profiles/profiles.model";
import { profileService } from "#modules/profiles/profiles.service";
import { buildApp, signAccessToken } from "../helpers/app.ts";
import { mkProfile, mkQuery, newId, stubMethod } from "../helpers/stubs.ts";

/**
 * The response serializer decides the wire format, so these pin the bytes a
 * client actually receives — a schema that declares `format: "date"` while
 * Mongoose hands over a full ISO timestamp is exactly the kind of drift a
 * contract is supposed to prevent.
 */
describe("profile response wire format", () => {
  const experience = [
    {
      _id: new Types.ObjectId(),
      title: "Senior Developer",
      company: "Acme Corp",
      from: new Date("2022-01-01T00:00:00.000Z"),
      to: new Date("2024-06-01T00:00:00.000Z"),
      current: false,
    },
  ];

  test("emits subdocument dates as YYYY-MM-DD, not ISO timestamps", async () => {
    const doc = mkProfile({ experience: experience as any });
    stubMethod(Profile, "findOne", () => mkQuery(doc as any));

    const profile = await profileService.getProfile(newId().toString());

    assert.deepEqual(
      profile.experience.map((entry) => ({ from: entry.from, to: entry.to })),
      [{ from: "2022-01-01", to: "2024-06-01" }],
    );
  });

  test("emits education dates as YYYY-MM-DD", async () => {
    const doc = mkProfile({
      education: [
        {
          _id: new Types.ObjectId(),
          school: "MIT",
          degree: "BSc",
          fieldofstudy: "CS",
          from: new Date("2018-09-01T00:00:00.000Z"),
        },
      ] as any,
    });
    stubMethod(Profile, "findOne", () => mkQuery(doc as any));

    const profile = await profileService.getProfile(newId().toString());

    assert.equal(profile.education[0].from, "2018-09-01");
    assert.equal(profile.education[0].to, undefined);
  });

  test("keeps already date-only values unchanged", async () => {
    const doc = mkProfile({
      experience: [
        {
          _id: new Types.ObjectId(),
          title: "Dev",
          company: "Acme",
          from: "2020-03-04" as any,
        },
      ] as any,
    });
    stubMethod(Profile, "findOne", () => mkQuery(doc as any));

    const profile = await profileService.getProfile(newId().toString());

    assert.equal(profile.experience[0].from, "2020-03-04");
  });
});

describe("POST /profiles/ — create-only", () => {
  const payload = { status: "Developer", skills: ["JS"] };

  async function post(body: unknown = payload) {
    const app = await buildApp({ withRoutes: true });
    try {
      return await app.inject({
        method: "POST",
        url: "/profiles/",
        headers: {
          authorization: `Bearer ${signAccessToken(app, {
            sub: newId().toString(),
          })}`,
        },
        payload: body as object,
      });
    } finally {
      await app.close();
    }
  }

  test("returns 201 and inserts rather than upserting", async () => {
    const created = mkProfile();
    const exists = stubMethod(Profile, "exists", () => Promise.resolve(null));
    // A real insert must not go through the upsert path: an upsert on a
    // `userId` filter would *match* a concurrently created profile and
    // overwrite it instead of failing.
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(null as any),
    );
    stubMethod(Profile, "create", () => Promise.resolve(created as any));

    const reply = await post();

    assert.equal(reply.statusCode, 201);
    assert.equal(exists.mock.callCount(), 1);
    assert.equal(findOneAndUpdate.mock.callCount(), 0);
  });

  test("returns 409 when a profile already exists", async () => {
    stubMethod(Profile, "exists", () => Promise.resolve({ _id: newId() } as any));
    const create = stubMethod(Profile, "create", () => Promise.resolve(null as any));

    const reply = await post();

    assert.equal(reply.statusCode, 409);
    assert.equal(reply.json().code, "PROFILE_ALREADY_EXISTS");
    // A friendly fast-fail: no insert attempted.
    assert.equal(create.mock.callCount(), 0);
  });

  test("maps a duplicate-key error to 409 (the race the index guards)", async () => {
    stubMethod(Profile, "exists", () => Promise.resolve(null));
    stubMethod(Profile, "create", () =>
      Promise.reject(Object.assign(new Error("E11000"), { code: 11000 })),
    );

    const reply = await post();

    assert.equal(reply.statusCode, 409);
    assert.equal(reply.json().code, "PROFILE_ALREADY_EXISTS");
  });
});

describe("request id and cache headers", () => {
  test("echoes an inbound x-request-id", async () => {
    const app = await buildApp({ withRoutes: true });
    try {
      const reply = await app.inject({
        method: "GET",
        url: "/profiles/",
        headers: { "x-request-id": "trace-abc-123" },
      });
      assert.equal(reply.headers["x-request-id"], "trace-abc-123");
    } finally {
      await app.close();
    }
  });

  test("replaces an unbounded or forged inbound request id", async () => {
    const app = await buildApp({ withRoutes: true });
    try {
      // Too long, and full of characters that would poison a log line.
      const reply = await app.inject({
        method: "GET",
        url: "/profiles/",
        headers: { "x-request-id": "a".repeat(200) },
      });
      assert.notEqual(reply.headers["x-request-id"], "a".repeat(200));
      assert.ok((reply.headers["x-request-id"] as string).length <= 64);
    } finally {
      await app.close();
    }
  });

  test("generates an id when none is supplied", async () => {
    const app = await buildApp({ withRoutes: true });
    try {
      const reply = await app.inject({ method: "GET", url: "/profiles/" });
      assert.ok(reply.headers["x-request-id"]);
    } finally {
      await app.close();
    }
  });

  test("caches the public list and the public profile, but not /me", async () => {
    const app = await buildApp({ withRoutes: true });
    try {
      stubMethod(Profile, "find", () => mkQuery([] as any));
      stubMethod(Profile, "countDocuments", () => mkQuery(0) as any);
      stubMethod(Profile, "findOne", () => mkQuery(mkProfile() as any));

      const list = await app.inject({ method: "GET", url: "/profiles/" });
      assert.equal(
        list.headers["cache-control"],
        "public, max-age=60, stale-while-revalidate=300",
      );

      const byId = await app.inject({
        method: "GET",
        url: `/profiles/user/${newId().toString()}`,
      });
      assert.equal(
        byId.headers["cache-control"],
        "public, max-age=60, stale-while-revalidate=300",
      );

      // Private read: caching it publicly would leak a profile to a CDN.
      const me = await app.inject({
        method: "GET",
        url: "/profiles/me",
        headers: {
          authorization: `Bearer ${signAccessToken(app, {
            sub: newId().toString(),
          })}`,
        },
      });
      assert.equal(me.headers["cache-control"], undefined);
    } finally {
      await app.close();
    }
  });
});
