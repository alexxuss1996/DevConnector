import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profiles/profiles.model";
import { profileService } from "#modules/profiles/profiles.service";
import {
  newId,
  mkCount,
  mkProfile,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "../helpers/stubs.ts";
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createRateLimitedTestApp } from "../helpers/test-app.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = await createRateLimitedTestApp({ oauth: oauthStub, db: noDb });
});

after(async () => {
  restoreAllStubs();
  await app.close();
});

afterEach(() => {
  restoreAllStubs();
});

describe("profileService.updateProfile", () => {
  test("a partial update on a missing profile is 404 without a redundant pre-read", async () => {
    const userId = newId();
    const findOne = stubMethod(Profile, "findOne", () => mkQuery(null));
    const findOneAndUpdate = stubMethod(Profile, "findOneAndUpdate", () =>
      Promise.resolve(null),
    );

    await assert.rejects(
      () =>
        profileService.updateProfile(userId.toString(), {
          company: "Acme",
        } as any),
      (err: any) =>
        err.statusCode === 404 && err.code === "PROFILE_NOT_FOUND",
    );

    assert.equal(
      findOneAndUpdate.mock.callCount(),
      1,
      "the write itself must still run and produce the 404",
    );
    assert.equal(
      findOne.mock.callCount(),
      0,
      "the leading findOne is a redundant round trip — findOneAndUpdate returns null and 404s on its own",
    );
  });

  test("a successful partial update does not read the profile first", async () => {
    const userId = newId();
    const persisted = mkProfile({ userId, company: "Acme" });
    const findOne = stubMethod(Profile, "findOne", () => mkQuery(persisted as any));
    stubMethod(Profile, "findOneAndUpdate", () => Promise.resolve(persisted as any));
    stubMethod(persisted, "populate", async function (this: any) {
      return this;
    });

    const updated = await profileService.updateProfile(userId.toString(), {
      company: "Acme",
    } as any);

    assert.equal(updated.company, "Acme");
    assert.equal(
      findOne.mock.callCount(),
      0,
      "a partial update should cost one round trip, not two",
    );
  });
});

describe("profileService.getProfiles", () => {
  test("counts with the O(1) metadata path rather than a per-page collection scan", async () => {
    const estimated = stubMethod(Profile, "estimatedDocumentCount", () =>
      Promise.resolve(3),
    );
    const counted = stubMethod(Profile, "countDocuments", () => mkCount(3));
    stubMethod(Profile, "find", () => mkQuery([]));

    const page = await profileService.getProfiles();

    assert.equal(page.total, 3);
    assert.equal(estimated.mock.callCount(), 1);
    assert.equal(
      counted.mock.callCount(),
      0,
      "no filter is ever applied, so countDocuments({}) is a full collection count on every list page",
    );
  });
});
