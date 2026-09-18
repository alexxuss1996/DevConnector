import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Post from "#modules/posts/posts.model";
import User from "#modules/users/user.model";
import {
  newId,
  mkUser,
  mkPost,
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

function authHeader(userId?: string) {
  const id = userId ?? newId().toString();
  return { authorization: `Bearer ${signAccessToken(app, { sub: id })}` };
}

// ============================================================
// POST /posts/ — authentication
// ============================================================
describe("POST /posts/ — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      payload: { text: "Hello world" },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: "Bearer " },
      payload: { text: "Hello" },
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
      url: "/posts/",
      headers: { authorization: `Bearer ${refreshToken}` },
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${token}x` },
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const user = mkUser({ _id: userId, name: "Test User", avatar: "https://example.com/a.png" });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const saved = mkPost({ userId, text: "Hello" });
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      this._id = saved._id;
      this.createdAt = saved.createdAt;
      this.updatedAt = saved.updatedAt;
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      cookies: { access_token: accessToken },
      payload: { text: "Hello from cookie" },
    });
    assert.equal(reply.statusCode, 200);
  });

  test("returns 401 for invalid authorization scheme", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Basic ${token}` },
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 401);
  });
});

// ============================================================
// POST /posts/ — validation
// ============================================================
describe("POST /posts/ — validation", () => {
  test("returns 400 when text is missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: {} as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when text is empty string", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: "" },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
    const body = reply.json() as any;
    const details = [...(body.issues ?? []), ...Object.values(body.fieldErrors ?? {}).flat()] as any[];
    assert.ok(
      details.some((e: any) =>
        typeof e === "string"
          ? e.includes("Text")
          : (e.path ?? []).includes("text") || (e.message ?? "").includes("Text"),
      ),
    );
  });

  test("returns 400 when text is not a string", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: 12345 } as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when text is null", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: null } as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("accepts valid text payload", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: "Valid User" });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      return this;
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { text: "Valid post text" },
    });
    assert.equal(reply.statusCode, 200);
  });

  test("accepts text with spaces and special chars", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: "User" });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      return this;
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { text: "Hello 🌍! Special chars: @#$%^&*()" },
    });
    assert.equal(reply.statusCode, 200);
  });
});

// ============================================================
// POST /posts/ — createPost logic
// ============================================================
describe("POST /posts/ — createPost logic", () => {
  test("creates post and returns 200 with persisted document", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const user = mkUser({ _id: userId, name: "Jane Doe", avatar: "https://example.com/avatar.png" });
    const findByIdStub = stubMethod(User, "findById", () => mkQuery(user as any));
    const postId = newId();
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      this._id = postId;
      this.userId = userId;
      this.name = user.name;
      this.avatar = user.avatar;
      this.createdAt = createdAt;
      this.updatedAt = createdAt;
      // ensure toJSON returns expected shape
      this.toJSON = () => ({
        _id: postId,
        userId: userId.toString(),
        name: user.name,
        avatar: user.avatar,
        text: this.text,
        createdAt,
        updatedAt: createdAt,
      });
      return this;
    });

    const payload = { text: "My first post" };
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${accessToken}` },
      payload,
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.equal(body.text, "My first post");
    assert.equal(body.name, "Jane Doe");
    assert.equal(body.avatar, "https://example.com/avatar.png");
    assert.equal(body.userId, userId.toString());

    assert.equal(findByIdStub.mock.callCount(), 1);
    const [idArg] = findByIdStub.mock.calls[0].arguments as any[];
    assert.equal(idArg.toString(), userId.toString());
  });

  test("uses userId from JWT sub, not from payload", async () => {
    const userId = newId();
    const attackerId = newId().toString();
    const user = mkUser({ _id: userId, name: "Legit User" });
    const findByIdStub = stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      return this;
    });

    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { text: "Hijack attempt", userId: attackerId } as any,
    });

    assert.equal(reply.statusCode, 200);
    const [idArg] = findByIdStub.mock.calls[0].arguments as any[];
    assert.equal(idArg.toString(), userId.toString());
    assert.notEqual(idArg.toString(), attackerId);
  });

  test("returns 404 when user not found", async () => {
    stubMethod(User, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "USER_NOT_FOUND", message: "User not found" });
  });

  test("returns 400 when user has no name", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: undefined as any });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.json(), { code: "VALIDATION_ERROR", message: "User has no name" });
  });

  test("returns 500 for unexpected DB error on User.findById", async () => {
    stubMethod(User, "findById", () => {
      throw new Error("DB boom");
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 500 for save error", async () => {
    const user = mkUser({ name: "Save Fail User" });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post.prototype as any, "save", async () => {
      throw new Error("save boom");
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: authHeader(),
      payload: { text: "Hello" },
    });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("creates post with correct avatar from user", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: "Avatar User", avatar: "https://example.com/avatar2.png" });
    stubMethod(User, "findById", () => mkQuery(user as any));
    let capturedText: string | undefined;
    stubMethod(Post.prototype as any, "save", async function (this: any) {
      capturedText = this.text;
      this.toJSON = () => ({ text: this.text, avatar: this.avatar, name: this.name, userId: this.userId });
      return this;
    });
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { text: "Check avatar" },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal(capturedText, "Check avatar");
    assert.equal((reply.json() as any).avatar, "https://example.com/avatar2.png");
  });
});

// ============================================================
// GET /posts/ — authentication
// ============================================================
describe("GET /posts/ — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "GET", url: "/posts/" });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: { authorization: "Bearer " },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for a refresh token", async () => {
    const refreshToken = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for a tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: { authorization: `Bearer ${token}x` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    stubMethod(Post, "find", () => mkQuery([] as any));
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      cookies: { access_token: accessToken },
    });
    assert.equal(reply.statusCode, 200);
  });

  test("returns 401 for invalid scheme", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: { authorization: `Basic ${token}` },
    });
    assert.equal(reply.statusCode, 401);
  });
});

// ============================================================
// GET /posts/ — logic
// ============================================================
describe("GET /posts/ — logic", () => {
  test("returns 200 with posts array when posts exist", async () => {
    const p1 = mkPost({ text: "Post 1", createdAt: new Date("2024-01-02T00:00:00Z") });
    const p2 = mkPost({ text: "Post 2", createdAt: new Date("2024-01-01T00:00:00Z") });
    stubMethod(Post, "find", () => mkQuery([p1, p2] as any));

    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(Array.isArray(body.posts));
    assert.equal(body.posts.length, 2);
  });

  test("returns posts sorted descending by createdAt (newest first)", async () => {
    const older = mkPost({ text: "Older", createdAt: new Date("2023-01-01T00:00:00Z") });
    const newer = mkPost({ text: "Newer", createdAt: new Date("2024-06-01T00:00:00Z") });
    const middle = mkPost({ text: "Middle", createdAt: new Date("2023-06-15T00:00:00Z") });
    // Return unsorted; service should sort descending
    stubMethod(Post, "find", () => mkQuery([older, newer, middle] as any));

    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 200);
    const posts = (reply.json() as any).posts;
    // After sorting, newest first
    assert.equal(posts[0].text, "Newer");
    assert.equal(posts[1].text, "Middle");
    assert.equal(posts[2].text, "Older");
  });

  test("returns 200 with empty array when no posts", async () => {
    stubMethod(Post, "find", () => mkQuery([] as any));
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual((reply.json() as any).posts, []);
  });

  test("calls Post.find().populate with user fields", async () => {
    const p1 = mkPost({});
    // Create a query spy to verify populate args
    let populateArgs: any[] | undefined;
    const q = mkQuery([p1] as any);
    const originalPopulate = q.populate;
    q.populate = (...args: any[]) => {
      populateArgs = args;
      return originalPopulate(...args);
    };
    const findStub = stubMethod(Post, "find", () => q);

    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 200);
    assert.equal(findStub.mock.callCount(), 1);
    // populate should have been called with userId and ["name","avatar"]
    assert.ok(populateArgs);
    assert.equal(populateArgs[0], "userId");
    assert.deepEqual(populateArgs[1], ["name", "avatar"]);
  });

  test("returns 500 for unexpected DB error", async () => {
    stubMethod(Post, "find", () => {
      throw new Error("DB boom");
    });
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 500 when populate throws", async () => {
    const q = mkQuery(null as any);
    q.populate = () => {
      throw new Error("populate boom");
    };
    stubMethod(Post, "find", () => q as any);
    const reply = await app.inject({
      method: "GET",
      url: "/posts/",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// DELETE /posts/ — authentication
// ============================================================
describe("DELETE /posts/ — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "DELETE", url: `/posts/${newId()}` });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for an empty Bearer token", async () => {
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: { authorization: "Bearer " },
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
      url: `/posts/${newId()}`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for a tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: { authorization: `Bearer ${token}x` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const accessToken = signAccessToken(app, { sub: userId.toString() });
    const post = mkPost({ userId });
    stubMethod(Post, "findOneAndDelete", () => Promise.resolve(post as any));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${post._id}`,
      cookies: { access_token: accessToken },
    });
    assert.equal(reply.statusCode, 204);
  });
});

// ============================================================
// DELETE /posts/ — logic
// ============================================================
describe("DELETE /posts/ — logic", () => {
  test("returns 204 on successful delete", async () => {
    const userId = newId();
    const post = mkPost({ userId });
    const findOneAndDelete = stubMethod(Post, "findOneAndDelete", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${post._id}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
    });

    assert.equal(reply.statusCode, 204);
    assert.equal(findOneAndDelete.mock.callCount(), 1);
    const [filter] = findOneAndDelete.mock.calls[0].arguments as any[];
    assert.deepEqual(filter, { _id: post._id.toString(), userId: userId.toString() });
    // 204 strips body — ensure no json body or empty
    assert.equal(reply.body, "");
  });

  test("uses userId from JWT sub, not from body", async () => {
    const userId = newId();
    const attackerId = newId().toString();
    const post = mkPost({ userId });
    const findOneAndDelete = stubMethod(Post, "findOneAndDelete", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${post._id}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userId.toString() })}` },
      payload: { userId: attackerId } as any,
    });

    assert.equal(reply.statusCode, 204);
    const [filter] = findOneAndDelete.mock.calls[0].arguments as any[];
    assert.equal(filter.userId, userId.toString());
    assert.notEqual(filter.userId, attackerId);
  });

  test("returns 500 when post not found (currently generic Error -> 500)", async () => {
    stubMethod(Post, "findOneAndDelete", () => Promise.resolve(null));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 500 for unexpected DB error", async () => {
    stubMethod(Post, "findOneAndDelete", () => {
      throw new Error("DB boom");
    });
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 500 when findOneAndDelete rejects", async () => {
    stubMethod(Post, "findOneAndDelete", () => Promise.reject(new Error("rejected")));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });

  test("deletes only the authenticated user's post (unique userId invariant)", async () => {
    const userIdA = newId();
    const userIdB = newId();
    const postA = mkPost({ userId: userIdA, text: "User A post" });
    // Stub to assert filter isolates by userId
    const findOneAndDelete = stubMethod(Post, "findOneAndDelete", ((filter: any) => {
      // Simulate DB: only delete if filter matches userIdA
      if (filter.userId === userIdA.toString()) return Promise.resolve(postA as any);
      return Promise.resolve(null);
    }) as any);

    const replyA = await app.inject({
      method: "DELETE",
      url: `/posts/${postA._id}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userIdA.toString() })}` },
    });
    assert.equal(replyA.statusCode, 204);
    assert.equal(findOneAndDelete.mock.callCount(), 1);
    restoreAllStubs();

    // Now try with B — should not delete A's post
    const findB = stubMethod(Post, "findOneAndDelete", () => Promise.resolve(null));
    const replyB = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}`,
      headers: { authorization: `Bearer ${signAccessToken(app, { sub: userIdB.toString() })}` },
    });
    assert.equal(replyB.statusCode, 404);
    assert.deepEqual(replyB.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
    assert.equal(findB.mock.callCount(), 1);
    assert.equal(findB.mock.calls[0].arguments[0].userId, userIdB.toString());
    assert.ok(findB.mock.calls[0].arguments[0]._id);
  });
});

// ============================================================
// postService unit — direct service coverage
// ============================================================
describe("postService — unit", () => {
  // Import service directly to test edge not covered by routes
  test("getPosts sorts by createdAt descending (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const older = mkPost({ createdAt: new Date("2022-01-01"), text: "old" });
    const newer = mkPost({ createdAt: new Date("2023-01-01"), text: "new" });
    stubMethod(Post, "find", () => mkQuery([older, newer] as any));
    const result = await postService.getPosts();
    assert.equal(result[0].text, "new");
    assert.equal(result[1].text, "old");
  });

  test("createPost throws when user has no name (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId().toString();
    const user = mkUser({ _id: newId(), name: undefined as any });
    stubMethod(User, "findById", () => mkQuery(user as any));
    await assert.rejects(
      () => postService.createPost(userId, "Hello"),
      (err: any) => {
        assert.equal(err.message, "User has no name");
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "VALIDATION_ERROR");
        return true;
      },
    );
  });

  test("deletePost throws Post not found when no post for user (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(Post, "findOneAndDelete", () => Promise.resolve(null));
    await assert.rejects(
      () => postService.deletePost(newId().toString(), newId().toString()),
      (err: any) => {
        assert.equal(err.message, "Post not found");
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });
});
