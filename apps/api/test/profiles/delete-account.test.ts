import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Profile from "#modules/profiles/profiles.model";
import User from "#modules/users/user.model";
import Post from "#modules/posts/posts.model";
import Session from "#modules/auth/session.model";
import { profileService } from "#modules/profiles/profiles.service";
import { newId, mkProfile, mkQuery, stubMethod, restoreAllStubs } from "../helpers/stubs.ts";
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createRateLimitedTestApp } from "../helpers/test-app.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  // `noDb` means there is no connection, so `supportsTransactions()` resolves
  // false and the non-transactional cascade is what runs here. That is exactly
  // the path that 500'd against a standalone server.
  app = await createRateLimitedTestApp({ oauth: oauthStub, db: noDb });
});

after(async () => {
  restoreAllStubs();
  await app.close();
});

afterEach(() => {
  restoreAllStubs();
});

function stubCascade(userId: ReturnType<typeof newId>) {
  const profile = mkProfile({ userId });
  const calls = {
    profileDelete: stubMethod(Profile, "findOneAndDelete", () => Promise.resolve(profile as any)),
    userDelete: stubMethod(User, "findOneAndDelete", () => Promise.resolve({ _id: userId } as any)),
    postDelete: stubMethod(Post, "deleteMany", () => mkQuery(null) as any),
    postUpdate: stubMethod(Post, "updateMany", () => mkQuery(null) as any),
    sessionDelete: stubMethod(Session, "deleteMany", () => mkQuery(null) as any),
  };
  return { profile, calls };
}

describe("profileService.deleteProfileAndUser — non-transactional cascade", () => {
  test("a missing user does not leave the account half-deleted", async () => {
    const userId = newId();
    stubMethod(Profile, "findOne", () => mkQuery(mkProfile({ userId })));
    stubMethod(User, "findOne", () => mkQuery(null));
    const calls = stubCascade(userId);

    await assert.rejects(
      () => profileService.deleteProfileAndUser(userId.toString()),
      (err: any) => err.code === "USER_NOT_FOUND",
    );

    assert.equal(
      calls.calls.profileDelete.mock.callCount(),
      0,
      "profile must not be deleted when the user is missing, or a retry finds nothing to finish",
    );
    assert.equal(calls.calls.userDelete.mock.callCount(), 0);
    assert.equal(calls.calls.postDelete.mock.callCount(), 0);
  });

  test("a missing profile deletes nothing at all", async () => {
    const userId = newId();
    stubMethod(Profile, "findOne", () => mkQuery(null));
    stubMethod(User, "findOne", () => mkQuery({ _id: userId } as any));
    const calls = stubCascade(userId);

    await assert.rejects(
      () => profileService.deleteProfileAndUser(userId.toString()),
      (err: any) => err.code === "PROFILE_NOT_FOUND",
    );

    assert.equal(calls.calls.profileDelete.mock.callCount(), 0);
    assert.equal(calls.calls.userDelete.mock.callCount(), 0);
  });

  test("the user document is deleted last, after the cascade", async () => {
    const userId = newId();
    const order: string[] = [];
    stubMethod(Profile, "findOne", () => mkQuery(mkProfile({ userId })));
    stubMethod(User, "findOne", () => mkQuery({ _id: userId } as any));
    stubCascade(userId);
    restoreAllStubs();

    stubMethod(Profile, "findOne", () => mkQuery(mkProfile({ userId })));
    stubMethod(User, "findOne", () => mkQuery({ _id: userId } as any));
    stubMethod(Post, "deleteMany", () => {
      order.push("posts");
      return mkQuery(null) as any;
    });
    stubMethod(Post, "updateMany", () => {
      order.push("postRefs");
      return mkQuery(null) as any;
    });
    stubMethod(Session, "deleteMany", () => {
      order.push("sessions");
      return mkQuery(null) as any;
    });
    stubMethod(Profile, "findOneAndDelete", () => {
      order.push("profile");
      return Promise.resolve(mkProfile({ userId }) as any);
    });
    stubMethod(User, "findOneAndDelete", () => {
      order.push("user");
      return Promise.resolve({ _id: userId } as any);
    });

    await profileService.deleteProfileAndUser(userId.toString());

    assert.deepEqual(order, ["posts", "postRefs", "sessions", "profile", "user"]);
    assert.equal(
      order[order.length - 1],
      "user",
      "user must be deleted last so a mid-cascade failure leaves a resumable account",
    );
  });

  test("the post cascade only touches posts that reference the user", async () => {
    const userId = newId();
    stubMethod(Profile, "findOne", () => mkQuery(mkProfile({ userId })));
    stubMethod(User, "findOne", () => mkQuery({ _id: userId } as any));
    const calls = stubCascade(userId);

    await profileService.deleteProfileAndUser(userId.toString());

    const [filter] = calls.calls.postUpdate.mock.calls[0].arguments as any[];
    assert.ok(
      Object.keys(filter).length > 0,
      "an unfiltered updateMany rewrites every post in the collection on every account deletion",
    );
    const clauses = (filter.$or ?? [filter]) as Array<Record<string, unknown>>;
    const keys = clauses.flatMap((clause) => Object.keys(clause));
    assert.ok(
      keys.includes("likes.userId") || keys.includes("comments.userId"),
      `filter should match on the referencing subdocuments, got ${JSON.stringify(filter)}`,
    );
  });
});
