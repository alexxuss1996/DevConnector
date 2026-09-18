import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Post from "#modules/posts/posts.model";
import User from "#modules/users/user.model";
import {
  newId,
  mkUser,
  mkPost,
  mkComment,
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
// PUT /posts/:id/like — authentication
// ============================================================
describe("PUT /posts/:id/like — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "PUT", url: `/posts/${newId()}/like` });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for empty Bearer token", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: { authorization: "Bearer " },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for refresh token", async () => {
    const refreshToken = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for tampered token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: { authorization: `Bearer ${token}x` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts token from cookie", async () => {
    const userId = newId();
    const postId = newId();
    const user = mkUser({ _id: userId });
    const post = mkPost({ _id: postId, likes: [{ userId }] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const token = signAccessToken(app, { sub: userId.toString() });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/like`,
      cookies: { access_token: token },
    });
    assert.equal(reply.statusCode, 204);
  });
});

// ============================================================
// PUT /posts/:id/like — logic
// ============================================================
describe("PUT /posts/:id/like — logic", () => {
  test("returns 204 on successful like", async () => {
    const userId = newId();
    const postId = newId();
    const user = mkUser({ _id: userId, name: "Liker" });
    const post: any = mkPost({ _id: postId, likes: [{ userId }] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/like`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 204);
    assert.equal(reply.body, "");
    assert.equal(updateStub.mock.callCount(), 1);
    const [likeFilter, likeUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(likeFilter._id.toString(), postId.toString());
    assert.ok(likeUpdate.$addToSet);
  });

  test("uses atomic $addToSet with $ne guard (no duplicate likes)", async () => {
    const userId = newId();
    const postId = newId();
    const post: any = mkPost({ _id: postId, likes: [{ userId }] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/like`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 204);
    assert.equal(updateStub.mock.callCount(), 1);
    const [guardFilter, guardUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(guardFilter._id.toString(), postId.toString());
    // $ne guard means concurrent likes cannot both match
    assert.ok(guardFilter["likes.userId"].$ne);
    assert.ok(guardUpdate.$addToSet);
  });

  test("returns 404 when post not found", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve(null));
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 404 when user not found", async () => {
    stubMethod(User, "findById", () => mkQuery(null));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "USER_NOT_FOUND", message: "User not found" });
  });

  test("returns 400 when already liked", async () => {
    const userId = newId();
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve({ _id: newId() } as any));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.json(), { code: "ALREADY_LIKED", message: "User already liked the post" });
  });

  test("returns 500 for DB error on update", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => { throw new Error("DB boom"); });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });

  test("returns 500 when existence check throws", async () => {
    const userId = newId();
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => { throw new Error("boom"); });

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 500);
  });

  test("uses userId from JWT sub not body", async () => {
    const userId = newId();
    const attackerId = newId().toString();
    const post: any = mkPost({ likes: [{ userId }] });
    const user = mkUser({ _id: userId });
    const findUserStub = stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/like`,
      headers: authHeader(userId.toString()),
      payload: { userId: attackerId } as any,
    });
    assert.equal(reply.statusCode, 204);
    assert.equal(findUserStub.mock.calls[0].arguments[0].toString(), userId.toString());
  });
});

// ============================================================
// PUT /posts/:id/unlike — authentication
// ============================================================
describe("PUT /posts/:id/unlike — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({ method: "PUT", url: `/posts/${newId()}/unlike` });
    assert.equal(reply.statusCode, 401);
  });
  test("returns 401 for refresh token", async () => {
    const refreshToken = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });
  test("accepts cookie token", async () => {
    const userId = newId();
    const post: any = mkPost({ likes: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const token = signAccessToken(app, { sub: userId.toString() });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      cookies: { access_token: token },
    });
    assert.equal(reply.statusCode, 204);
  });
});

// ============================================================
// PUT /posts/:id/unlike — logic
// ============================================================
describe("PUT /posts/:id/unlike — logic", () => {
  test("returns 204 on successful unlike", async () => {
    const userId = newId();
    const post: any = mkPost({ likes: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 204);
    assert.equal(updateStub.mock.callCount(), 1);
    const [, unlikeUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.ok(unlikeUpdate.$pull);
  });

  test("returns 404 when post not found", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve(null));
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 404 when user not found", async () => {
    stubMethod(User, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "USER_NOT_FOUND", message: "User not found" });
  });

  test("returns 400 when not liked", async () => {
    const userId = newId();
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve({ _id: newId() } as any));
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.json(), { code: "NOT_LIKED", message: "User did not like the post" });
  });

  test("returns 500 for DB error", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => { throw new Error("boom"); });
    const reply = await app.inject({
      method: "PUT",
      url: `/posts/${newId()}/unlike`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// GET /posts/:id/comments — requires auth (like the posts feed)
// ============================================================
describe("GET /posts/:id/comments — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({ method: "GET", url: `/posts/${newId()}/comments` });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 200 with comments with auth", async () => {
    const postId = newId();
    const c1 = mkComment({ text: "c1" });
    const c2 = mkComment({ text: "c2" });
    const post = mkPost({ _id: postId, comments: [c1 as any, c2 as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({ method: "GET", url: `/posts/${postId}/comments`, headers: authHeader() });
    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(Array.isArray(body.comments));
    assert.equal(body.comments.length, 2);
  });

  test("works with auth token as well", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId, comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId}/comments`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 200);
  });

  test("returns 404 when post not found", async () => {
    stubMethod(Post, "findById", () => mkQuery(null));
    const reply = await app.inject({ method: "GET", url: `/posts/${newId()}/comments`, headers: authHeader() });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 200 with empty array when no comments", async () => {
    const post = mkPost({ comments: [] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    const reply = await app.inject({ method: "GET", url: `/posts/${newId()}/comments`, headers: authHeader() });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual((reply.json() as any).comments, []);
  });

  test("calls Post.findById with correct id", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId, comments: [] });
    const stub = stubMethod(Post, "findById", () => mkQuery(post as any));
    const reply = await app.inject({ method: "GET", url: `/posts/${postId}/comments`, headers: authHeader() });
    assert.equal(reply.statusCode, 200);
    assert.equal(stub.mock.callCount(), 1);
    assert.equal(stub.mock.calls[0].arguments[0].toString(), postId.toString());
  });

  test("returns 500 for DB error", async () => {
    stubMethod(Post, "findById", () => { throw new Error("boom"); });
    const reply = await app.inject({ method: "GET", url: `/posts/${newId()}/comments`, headers: authHeader() });
    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// POST /posts/:id/comments — authentication
// ============================================================
describe("POST /posts/:id/comments — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      payload: { text: "hello" },
    });
    assert.equal(reply.statusCode, 401);
  });
  test("returns 401 for refresh token", async () => {
    const refreshToken = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: { authorization: `Bearer ${refreshToken}` },
      payload: { text: "hello" },
    });
    assert.equal(reply.statusCode, 401);
  });
  test("accepts cookie token", async () => {
    const userId = newId();
    const postId = newId();
    const user = mkUser({ _id: userId, name: "Commenter", avatar: "https://example.com/a.png" });
    const post: any = mkPost({ _id: postId, comments: [mkComment({ userId, text: "cookie comment" }) as any] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const token = signAccessToken(app, { sub: userId.toString() });
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${postId}/comments`,
      cookies: { access_token: token },
      payload: { text: "cookie comment" },
    });
    assert.equal(reply.statusCode, 201);
  });
});

// ============================================================
// POST /posts/:id/comments — validation
// ============================================================
describe("POST /posts/:id/comments — validation", () => {
  test("returns 400 when text missing", async () => {
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: {} as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
  test("returns 400 when text empty", async () => {
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: "" },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
  test("returns 400 when text not string", async () => {
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: 123 } as any,
    });
    assert.equal(reply.statusCode, 400);
  });
  test("accepts valid text", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: "Valid" });
    const post: any = mkPost({ comments: [mkComment({ userId, text: "valid comment" }) as any] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(userId.toString()),
      payload: { text: "valid comment" },
    });
    assert.equal(reply.statusCode, 201);
  });
});

// ============================================================
// POST /posts/:id/comments — logic
// ============================================================
describe("POST /posts/:id/comments — logic", () => {
  test("creates comment and returns 201", async () => {
    const userId = newId();
    const postId = newId();
    const user = mkUser({ _id: userId, name: "Jane", avatar: "https://example.com/j.png" });
    const post: any = mkPost({ _id: postId, comments: [mkComment({ userId, text: "my comment", name: "Jane" }) as any] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "POST",
      url: `/posts/${postId}/comments`,
      headers: authHeader(userId.toString()),
      payload: { text: "my comment" },
    });
    assert.equal(reply.statusCode, 201);
    // Atomic $push carries the denormalized author fields
    const [, pushUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(pushUpdate.$push.comments.text, "my comment");
    assert.equal(pushUpdate.$push.comments.name, "Jane");
    const body = reply.json() as any;
    assert.equal(body.length, 1);
  });

  test("uses avatar fallback when user has no avatar", async () => {
    const userId = newId();
    const user = mkUser({ _id: userId, name: "NoAvatar", avatar: undefined as any });
    const post: any = mkPost({ comments: [mkComment({ text: "fallback", avatar: "" }) as any] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(userId.toString()),
      payload: { text: "fallback" },
    });
    assert.equal(reply.statusCode, 201);
    const [, fallbackUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(fallbackUpdate.$push.comments.avatar, "");
  });

  test("returns 404 when post not found", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 404 when user not found", async () => {
    stubMethod(User, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "USER_NOT_FOUND", message: "User not found" });
  });

  test("returns 400 when user has no name", async () => {
    const user = mkUser({ name: undefined as any });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.json(), { code: "VALIDATION_ERROR", message: "User has no name" });
  });

  test("returns 500 for update error", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => { throw new Error("boom"); });
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 500);
  });

  test("uses JWT sub not payload userId", async () => {
    const userId = newId();
    const post: any = mkPost({ comments: [mkComment({ userId, text: "hijack" }) as any] });
    const user = mkUser({ _id: userId, name: "Legit" });
    const findUserStub = stubMethod(User, "findById", () => mkQuery(user as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const reply = await app.inject({
      method: "POST",
      url: `/posts/${newId()}/comments`,
      headers: authHeader(userId.toString()),
      payload: { text: "hijack", userId: newId().toString() } as any,
    });
    assert.equal(reply.statusCode, 201);
    assert.equal(findUserStub.mock.calls[0].arguments[0].toString(), userId.toString());
  });
});

// ============================================================
// DELETE /posts/:id/comments/:commentId — authentication
// ============================================================
describe("DELETE /posts/:id/comments/:commentId — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({ method: "DELETE", url: `/posts/${newId()}/comments/${newId()}` });
    assert.equal(reply.statusCode, 401);
  });
  test("returns 401 for refresh token", async () => {
    const refreshToken = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${newId()}`,
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    assert.equal(reply.statusCode, 401);
  });
  test("accepts cookie token", async () => {
    const userId = newId();
    const comment = mkComment({ userId });
    const post: any = mkPost({ comments: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const token = signAccessToken(app, { sub: userId.toString() });
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${comment._id}`,
      cookies: { access_token: token },
    });
    assert.equal(reply.statusCode, 204);
  });
});

// ============================================================
// DELETE /posts/:id/comments/:commentId — logic
// ============================================================
describe("DELETE /posts/:id/comments/:commentId — logic", () => {
  test("returns 204 on successful delete", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "to delete" });
    const post: any = mkPost({ comments: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${comment._id}`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 204);
    assert.equal(reply.body, "");
    const [, pullUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(pullUpdate.$pull.comments._id.toString(), comment._id.toString());
  });

  test("returns 404 when post not found", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 404 when user not found", async () => {
    stubMethod(User, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "USER_NOT_FOUND", message: "User not found" });
  });

  test("returns 404 when comment not found (bad commentId)", async () => {
    const userId = newId();
    const post = mkPost({ comments: [mkComment({ userId }) as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${newId()}`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "COMMENT_NOT_FOUND", message: "Comment not found" });
  });

  test("returns 403 when user did not author comment", async () => {
    const authorId = newId();
    const otherUserId = newId();
    const comment = mkComment({ userId: authorId });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: otherUserId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${comment._id}`,
      headers: authHeader(otherUserId.toString()),
    });
    assert.equal(reply.statusCode, 403);
    assert.deepEqual(reply.json(), { code: "FORBIDDEN", message: "Not authorized" });
  });

  test("returns 500 for DB error", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser() as any));
    stubMethod(Post, "findOneAndUpdate", () => { throw new Error("boom"); });
    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${newId()}`,
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 500);
  });

  test("only deletes targeted comment", async () => {
    const userId = newId();
    const c1 = mkComment({ userId, text: "c1" });
    const c2 = mkComment({ userId, text: "c2" });
    const post: any = mkPost({ comments: [c2 as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "DELETE",
      url: `/posts/${newId()}/comments/${c1._id}`,
      headers: authHeader(userId.toString()),
    });
    assert.equal(reply.statusCode, 204);
    const [, targetedUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(targetedUpdate.$pull.comments._id.toString(), c1._id.toString());
  });
});

// ============================================================
// postService — unit for new methods
// ============================================================
describe("postService — unit (new methods)", () => {
  test("getPostComments returns comments array", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const comments = [mkComment() as any, mkComment() as any];
    const post = mkPost({ comments });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    const result = await postService.getPostComments(newId().toString());
    assert.equal(result.length, 2);
  });

  test("getPostComments throws 404 when post not found", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(Post, "findById", () => mkQuery(null));
    await assert.rejects(
      () => postService.getPostComments(newId().toString()),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });

  test("createPostComment pushes atomically and returns comments", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const user = mkUser({ _id: userId, name: "Tester", avatar: "https://example.com/a.png" });
    const post: any = mkPost({ comments: [mkComment({ userId, text: "hello", name: "Tester" }) as any] });
    stubMethod(User, "findById", () => mkQuery(user as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const result = await postService.createPostComment(userId.toString(), newId().toString(), "hello");
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "hello");
    const [, pushUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(pushUpdate.$push.comments.name, "Tester");
  });

  test("likePost throws ALREADY_LIKED", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve({ _id: newId() } as any));
    await assert.rejects(
      () => postService.likePost(userId.toString(), newId().toString()),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "ALREADY_LIKED");
        return true;
      },
    );
  });

  test("unlikePost throws NOT_LIKED when not liked", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "exists", () => Promise.resolve({ _id: newId() } as any));
    await assert.rejects(
      () => postService.unlikePost(userId.toString(), newId().toString()),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "NOT_LIKED");
        return true;
      },
    );
  });

  test("deletePostComment removes comment atomically", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const c = mkComment({ userId });
    const post: any = mkPost({ comments: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    await postService.deletePostComment(userId.toString(), newId().toString(), c._id.toString());
    const [, removeUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(removeUpdate.$pull.comments._id.toString(), c._id.toString());
  });

  test("deletePostComment throws COMMENT_NOT_FOUND", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const post = mkPost({ comments: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () => postService.deletePostComment(userId.toString(), newId().toString(), newId().toString()),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "COMMENT_NOT_FOUND");
        return true;
      },
    );
  });

  test("updatePostComment throws COMMENT_NOT_FOUND", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const post = mkPost({ comments: [] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId, name: "n" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () => postService.updatePostComment(userId.toString(), newId().toString(), newId().toString(), "new"),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "COMMENT_NOT_FOUND");
        return true;
      },
    );
  });

  test("updatePostComment success updates text", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const c = mkComment({ userId, text: "new text" });
    const post: any = mkPost({ comments: [c as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: userId, name: "n" }) as any));
    const updateStub = stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const result = await postService.updatePostComment(userId.toString(), newId().toString(), c._id.toString(), "new text");
    assert.equal(result.text, "new text");
    const [, setUpdate] = updateStub.mock.calls[0].arguments as any[];
    assert.equal(setUpdate.$set["comments.$.text"], "new text");
  });

  test("updatePostComment throws FORBIDDEN when not author", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const authorId = newId();
    const otherId = newId();
    const c = mkComment({ userId: authorId, text: "old" });
    const post = mkPost({ comments: [c as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: otherId, name: "x" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () => postService.updatePostComment(otherId.toString(), newId().toString(), c._id.toString(), "hacked"),
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      },
    );
  });

  test("updatePostComment throws POST_NOT_FOUND", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(User, "findById", () => mkQuery(mkUser({ name: "n" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(null));
    await assert.rejects(
      () => postService.updatePostComment(newId().toString(), newId().toString(), newId().toString(), "t"),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });

  test("deletePostComment throws FORBIDDEN when not author (unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const authorId = newId();
    const otherId = newId();
    const c = mkComment({ userId: authorId });
    const post = mkPost({ comments: [c as any] });
    stubMethod(User, "findById", () => mkQuery(mkUser({ _id: otherId }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () => postService.deletePostComment(otherId.toString(), newId().toString(), c._id.toString()),
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      },
    );
  });
});
