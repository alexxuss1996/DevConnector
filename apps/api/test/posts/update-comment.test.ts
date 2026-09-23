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

function url(
  postId: string | { toString(): string },
  commentId: string | { toString(): string },
) {
  return `/posts/${postId.toString()}/comments/${commentId.toString()}`;
}

// ============================================================
// PUT /posts/:id/comments/:commentId — authentication
// ============================================================
describe("PUT /posts/:id/comments/:commentId — authentication", () => {
  test("returns 401 without a token", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      payload: { text: "new" },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), {
      code: "FAILED_AUTHENTICATION",
      message: "Unauthorized",
    });
  });

  test("returns 401 for empty Bearer token", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: { authorization: "Bearer " },
      payload: { text: "new" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for refresh token", async () => {
    const refresh = signRefreshToken(app, {
      sub: newId().toString(),
      sessionId: newId().toString(),
    });
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: { authorization: `Bearer ${refresh}` },
      payload: { text: "new" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for tampered token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: { authorization: `Bearer ${token}x` },
      payload: { text: "new" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts token from cookie", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "updated via cookie" });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Author" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const token = signAccessToken(app, { sub: userId.toString() });
    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      cookies: { access_token: token },
      payload: { text: "updated via cookie" },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json() as any).text, "updated via cookie");
  });
});

// ============================================================
// PUT /posts/:id/comments/:commentId — validation
// ============================================================
describe("PUT /posts/:id/comments/:commentId — validation", () => {
  test("returns 400 when text is empty string", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "" },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("returns 400 when text is not a string", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: 123 } as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("rejects empty body (Update schema requires minProperties: 1)", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "old" });
    const post: any = mkPost({ comments: [comment as any] });
    post.save = async function () {
      return this;
    };
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Author" }) as any),
    );

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: {},
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("accepts valid text", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "valid update" });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Author" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: { text: "valid update" },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json() as any).text, "valid update");
  });

  test("returns 400 when text is null (if provided)", async () => {
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: null } as any,
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
});

// ============================================================
// PUT /posts/:id/comments/:commentId — logic
// ============================================================
describe("PUT /posts/:id/comments/:commentId — logic", () => {
  test("returns 200 with updated comment and persists", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "after" });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Updater" }) as any),
    );
    const updateStub = stubMethod(Post, "findOneAndUpdate", () =>
      Promise.resolve(post as any),
    );

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: { text: "after" },
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.equal(body.text, "after");
    assert.equal(body._id.toString(), comment._id.toString());
    assert.equal(updateStub.mock.callCount(), 1);
    const [commentFilter, commentUpdate] = updateStub.mock.calls[0]
      .arguments as any[];
    assert.equal(commentFilter._id.toString(), post._id.toString());
    assert.equal(commentUpdate.$set["comments.$.text"], "after");
  });

  test("rejects empty body instead of no-op save", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "keep" });
    const post: any = mkPost({ comments: [comment as any] });
    post.save = async function () {
      return this;
    };
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Keep" }) as any),
    );

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: {},
    });
    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
    assert.equal(comment.text, "keep");
  });

  test("returns 404 when post not found", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser({ name: "n" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), {
      code: "POST_NOT_FOUND",
      message: "Post not found",
    });
  });

  test("returns 404 when user not found", async () => {
    const post = mkPost({ comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () => mkQuery(null));
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), {
      code: "USER_NOT_FOUND",
      message: "User not found",
    });
  });

  test("returns 400 when user has no name", async () => {
    const post = mkPost({ comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ name: undefined as any }) as any),
    );
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.json(), {
      code: "VALIDATION_ERROR",
      message: "User has no name",
    });
  });

  test("returns 404 when comment not found", async () => {
    const userId = newId();
    const post = mkPost({ comments: [mkComment({ userId }) as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "n" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(userId.toString()),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), {
      code: "COMMENT_NOT_FOUND",
      message: "Comment not found",
    });
  });

  test("returns 403 when not author", async () => {
    const authorId = newId();
    const otherId = newId();
    const comment = mkComment({ userId: authorId, text: "orig" });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: otherId, name: "other" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(otherId.toString()),
      payload: { text: "hacked" },
    });
    assert.equal(reply.statusCode, 403);
    assert.deepEqual(reply.json(), {
      code: "FORBIDDEN",
      message: "Not authorized",
    });
    // ensure not mutated
    assert.equal(comment.text, "orig");
  });

  test("returns 500 for DB error on update", async () => {
    stubMethod(User, "findById", () => mkQuery(mkUser({ name: "n" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => {
      throw new Error("boom");
    });
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    });
  });

  test("returns 500 for DB error on User.findById", async () => {
    const post = mkPost({ comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () => {
      throw new Error("boom");
    });
    const reply = await app.inject({
      method: "PUT",
      url: url(newId(), newId()),
      headers: authHeader(),
      payload: { text: "hi" },
    });
    assert.equal(reply.statusCode, 500);
  });

  test("returns 500 when update throws", async () => {
    const userId = newId();
    const comment = mkComment({ userId, text: "old" });
    const post: any = mkPost({ comments: [comment as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "n" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", async () => {
      throw new Error("update boom");
    });
    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: { text: "new" },
    });
    assert.equal(reply.statusCode, 500);
  });

  test("uses userId from JWT sub not body", async () => {
    const userId = newId();
    const attackerId = newId().toString();
    const comment = mkComment({ userId, text: "updated" });
    const post: any = mkPost({ comments: [comment as any] });
    const findUserStub = stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "legit" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, comment._id),
      headers: authHeader(userId.toString()),
      payload: { text: "updated", userId: attackerId } as any,
    });
    assert.equal(reply.statusCode, 200);
    assert.equal(
      findUserStub.mock.calls[0].arguments[0].toString(),
      userId.toString(),
    );
  });

  test("only updates targeted comment among many", async () => {
    const userId = newId();
    const c1 = mkComment({ userId, text: "c1 updated" });
    const c2 = mkComment({ userId, text: "c2" });
    const post: any = mkPost({ comments: [c1 as any, c2 as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "n" }) as any),
    );
    const updateStub = stubMethod(Post, "findOneAndUpdate", () =>
      Promise.resolve(post as any),
    );

    const reply = await app.inject({
      method: "PUT",
      url: url(post._id, c1._id),
      headers: authHeader(userId.toString()),
      payload: { text: "c1 updated" },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json() as any)._id.toString(), c1._id.toString());
    // Ownership is enforced atomically via $elemMatch on the update filter
    const [targetedFilter, targetedUpdate] = updateStub.mock.calls[0]
      .arguments as any[];
    assert.ok(targetedFilter.comments.$elemMatch);
    assert.equal(targetedUpdate.$set["comments.$.text"], "c1 updated");
  });
});

// ============================================================
// postService.updatePostComment — unit
// ============================================================
describe("postService.updatePostComment — unit", () => {
  test("success returns updated comment", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const c = mkComment({ userId, text: "new" });
    const post: any = mkPost({ comments: [c as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "Tester" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(post as any));
    const result = await postService.updatePostComment(
      userId.toString(),
      newId().toString(),
      c._id.toString(),
      "new",
    );
    assert.equal(result.text, "new");
  });

  test("throws POST_NOT_FOUND when post missing", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(User, "findById", () => mkQuery(mkUser({ name: "n" }) as any));
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(null));
    await assert.rejects(
      () =>
        postService.updatePostComment(
          newId().toString(),
          newId().toString(),
          newId().toString(),
          "t",
        ),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });

  test("throws USER_NOT_FOUND when user missing", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const post = mkPost({ comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () => mkQuery(null));
    await assert.rejects(
      () =>
        postService.updatePostComment(
          newId().toString(),
          newId().toString(),
          newId().toString(),
          "t",
        ),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "USER_NOT_FOUND");
        return true;
      },
    );
  });

  test("throws VALIDATION_ERROR when user has no name", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const post = mkPost({ comments: [mkComment() as any] });
    stubMethod(Post, "findById", () => mkQuery(post as any));
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ name: undefined as any }) as any),
    );
    await assert.rejects(
      () =>
        postService.updatePostComment(
          newId().toString(),
          newId().toString(),
          newId().toString(),
          "t",
        ),
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "VALIDATION_ERROR");
        return true;
      },
    );
  });

  test("throws COMMENT_NOT_FOUND when comment missing", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const userId = newId();
    const post = mkPost({ comments: [] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: userId, name: "n" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () =>
        postService.updatePostComment(
          userId.toString(),
          newId().toString(),
          newId().toString(),
          "t",
        ),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "COMMENT_NOT_FOUND");
        return true;
      },
    );
  });

  test("throws FORBIDDEN when not author", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const authorId = newId();
    const otherId = newId();
    const c = mkComment({ userId: authorId });
    const post = mkPost({ comments: [c as any] });
    stubMethod(User, "findById", () =>
      mkQuery(mkUser({ _id: otherId, name: "x" }) as any),
    );
    stubMethod(Post, "findOneAndUpdate", () => Promise.resolve(null));
    stubMethod(Post, "findById", () => mkQuery(post as any));
    await assert.rejects(
      () =>
        postService.updatePostComment(
          otherId.toString(),
          newId().toString(),
          c._id.toString(),
          "hacked",
        ),
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      },
    );
  });
});
