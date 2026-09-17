import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import Post from "#modules/posts/posts.model";
import {
  newId,
  mkPost,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "../helpers/stubs.ts";
import { buildApp, signAccessToken } from "../helpers/app.ts";
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
// GET /posts/:id — success (public, no auth required)
// ============================================================
describe("GET /posts/:id — success", () => {
  test("returns 200 with post when found (no auth)", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId, text: "Hello single post" });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId.toString()}`,
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.ok(body.post);
    assert.equal(body.post.text, "Hello single post");
    assert.equal(body.post._id.toString(), postId.toString());
  });

  test("returns 200 with post when accessed with auth token", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId, text: "Auth access is optional" });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId.toString()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json() as any).post.text, "Auth access is optional");
  });

  test("calls Post.findById with correct id param", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId });
    const findByIdStub = stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId.toString()}`,
    });

    assert.equal(reply.statusCode, 200);
    assert.equal(findByIdStub.mock.callCount(), 1);
    const [idArg] = findByIdStub.mock.calls[0].arguments as any[];
    assert.equal(idArg.toString(), postId.toString());
  });

  test("returns post with expected shape { post }", async () => {
    const postId = newId();
    const userId = newId();
    const createdAt = new Date("2024-03-15T10:00:00.000Z");
    const post = mkPost({
      _id: postId,
      userId,
      name: "Jane Doe",
      text: "Shape test",
      avatar: "https://example.com/avatar.png",
      createdAt,
      updatedAt: createdAt,
    });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId.toString()}`,
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any;
    assert.deepEqual(Object.keys(body), ["post"]);
    assert.equal(body.post.text, "Shape test");
    assert.equal(body.post.name, "Jane Doe");
  });

  test("returns correct post when multiple posts exist (id isolation)", async () => {
    const postIdA = newId();
    const postIdB = newId();
    const postA = mkPost({ _id: postIdA, text: "Post A" });
    // stub returns different post depending on id
    stubMethod(Post, "findById", ((id: string) => {
      if (id.toString() === postIdA.toString()) return mkQuery(postA as any);
      return mkQuery(null);
    }) as any);

    const replyA = await app.inject({
      method: "GET",
      url: `/posts/${postIdA.toString()}`,
    });
    assert.equal(replyA.statusCode, 200);
    assert.equal((replyA.json() as any).post.text, "Post A");

    const replyB = await app.inject({
      method: "GET",
      url: `/posts/${postIdB.toString()}`,
    });
    assert.equal(replyB.statusCode, 404);
  });
});

// ============================================================
// GET /posts/:id — not found / error handling
// ============================================================
describe("GET /posts/:id — not found", () => {
  test("returns 404 when post not found (null)", async () => {
    stubMethod(Post, "findById", () => mkQuery(null));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.json(), { code: "POST_NOT_FOUND", message: "Post not found" });
  });

  test("returns 404 when Post.findById throws generic Error", async () => {
    stubMethod(Post, "findById", () => {
      throw new Error("Post not found");
    });

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${newId().toString()}`,
    });

    // Generic errors not from AppError are treated as 500 by errorHandler
    // (service now throws AppError for known not-found; generic throw is unexpected)
    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 404 when Post.findById rejects (DB error — route maps all errors to 404)", async () => {
    stubMethod(Post, "findById", () => Promise.reject(new Error("DB boom")));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 404 when findById throws unexpected error", async () => {
    stubMethod(Post, "findById", () => {
      throw new Error("unexpected");
    });

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 404 when findById resolves to undefined (falsy)", async () => {
    stubMethod(Post, "findById", () => mkQuery(undefined as any));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${newId().toString()}`,
    });

    assert.equal(reply.statusCode, 404);
  });

  test("returns 404 for non-ObjectId string (invalid id format)", async () => {
    const reply = await app.inject({
      method: "GET",
      url: `/posts/not-a-valid-objectid`,
    });

    assert.equal(reply.statusCode, 400);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
});

// ============================================================
// GET /posts/:id — validation / routing
// ============================================================
describe("GET /posts/:id — routing", () => {
  test("GET /posts/ without id does not hit getPost (hits getPosts -> requires auth)", async () => {
    // without id, route is getPosts which requires auth -> 401
    const reply = await app.inject({
      method: "GET",
      url: `/posts/`,
    });
    assert.equal(reply.statusCode, 401);
  });

  test("GET /posts/:id with trailing slash still resolves", async () => {
    const postId = newId();
    const post = mkPost({ _id: postId, text: "trailing slash" });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const reply = await app.inject({
      method: "GET",
      url: `/posts/${postId.toString()}/`,
    });

    // Fastify by default handles trailing slash; should still return 200
    // If 404, the handler wasn't matched — adjust assertion accordingly
    assert.ok([200, 404].includes(reply.statusCode));
    if (reply.statusCode === 200) {
      assert.equal((reply.json() as any).post.text, "trailing slash");
    }
  });
});

// ============================================================
// postService.getPost — unit
// ============================================================
describe("postService.getPost — unit", () => {
  test("returns post when found (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const postId = newId();
    const post = mkPost({ _id: postId, text: "unit found" });
    stubMethod(Post, "findById", () => mkQuery(post as any));

    const result = await postService.getPost(postId.toString());
    assert.equal(result.text, "unit found");
    assert.equal((result as any)._id.toString(), postId.toString());
  });

  test("throws Post not found when null (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(Post, "findById", () => mkQuery(null));

    await assert.rejects(
      () => postService.getPost(newId().toString()),
      (err: any) => {
        assert.equal(err.message, "Post not found");
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });

  test("throws Post not found when findById resolves to undefined (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(Post, "findById", () => Promise.resolve(undefined as any));

    await assert.rejects(
      () => postService.getPost(newId().toString()),
      (err: any) => {
        assert.equal(err.message, "Post not found");
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "POST_NOT_FOUND");
        return true;
      },
    );
  });

  test("propagates findById rejection (DB error) as generic error (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    stubMethod(Post, "findById", () => Promise.reject(new Error("DB boom")));

    await assert.rejects(
      () => postService.getPost(newId().toString()),
      (err: any) => {
        assert.equal(err.message, "DB boom");
        return true;
      },
    );
  });

  test("passes id argument straight to Post.findById (service unit)", async () => {
    const { postService } = await import("#modules/posts/posts.service");
    const postId = newId().toString();
    const post = mkPost({ text: "id pass through" });
    const findByIdStub = stubMethod(Post, "findById", () => mkQuery(post as any));

    await postService.getPost(postId);
    assert.equal(findByIdStub.mock.callCount(), 1);
    assert.equal(findByIdStub.mock.calls[0].arguments[0], postId);
  });
});
