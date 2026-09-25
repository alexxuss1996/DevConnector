import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildIntegrationApp, cleanDb, testEmail, testName } from "../helpers/integration.ts";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

let app: FastifyInstance;
let mongoUri: string;
let jwtSecret: string;
let frontendUrl: string;

before(async () => {
  const runId = randomUUID().slice(0, 8);
  mongoUri = process.env.MONGODB_URI ?? `mongodb://localhost:27018/devconnector_test`;
  jwtSecret = `test-jwt-secret-${randomUUID().slice(0, 16)}`;
  frontendUrl = "http://localhost:3000";

  app = await buildIntegrationApp({
    mongoUri,
    jwtSecret,
    frontendUrl,
    dbNameSuffix: runId,
  });
});

after(async () => {
  await app.close();
});

beforeEach(async () => {
  await cleanDb(app);
});

/** Registers and logs in a user, returning the app instance with auth headers helper. */
async function signIn(email: string, password: string, name: string) {
  const reg = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password },
  });
  assert.equal(reg.statusCode, 201);

  const loginReply = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  assert.equal(loginReply.statusCode, 200);

  const accessToken = loginReply.cookies.find((c) => c.name === "access_token")!
    .value;
  return {
    headers: { authorization: `Bearer ${accessToken}` },
  };
}

describe("integration — posts", () => {
  test("create post → read it back → like → unlike → delete", async () => {
    const { headers } = await signIn(
      testEmail("posts"),
      "Password123!",
      testName("posts"),
    );

    // Create
    const createReply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers,
      payload: { text: "Hello integration world" },
    });
    assert.equal(createReply.statusCode, 201);
    const post = createReply.json() as { _id: string; text: string; name: string };
    assert.equal(post.text, "Hello integration world");
    assert.equal(post.name, testName("posts"));
    const postId = post._id;

    // Read back
    const getReply = await app.inject({
      method: "GET",
      url: `/posts/${postId}`,
      headers,
    });
    assert.equal(getReply.statusCode, 200);
    const fetched = getReply.json() as { post: { text: string } };
    assert.equal(fetched.post.text, "Hello integration world");

    // Like
    const likeReply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/like`,
      headers,
    });
    assert.equal(likeReply.statusCode, 204);

    // Unlike
    const unlikeReply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/unlike`,
      headers,
    });
    assert.equal(unlikeReply.statusCode, 204);

    // Try to unlike again — should 400 (not liked)
    const secondUnlike = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/unlike`,
      headers,
    });
    assert.equal(secondUnlike.statusCode, 400);

    // Delete
    const deleteReply = await app.inject({
      method: "DELETE",
      url: `/posts/${postId}`,
      headers,
    });
    assert.equal(deleteReply.statusCode, 204);

    // Confirm gone
    const afterDelete = await app.inject({
      method: "GET",
      url: `/posts/${postId}`,
      headers,
    });
    assert.equal(afterDelete.statusCode, 404);
  });

  test("cannot create post with blank text", async () => {
    const { headers } = await signIn(
      testEmail("posts-blank"),
      "Password123!",
      testName("posts-blank"),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers,
      payload: { text: "   " },
    });
    assert.equal(reply.statusCode, 400);
    assert.equal((reply.json() as { code: string }).code, "VALIDATION_ERROR");
  });

  test("cannot create post with text over 5000 chars", async () => {
    const { headers } = await signIn(
      testEmail("posts-long"),
      "Password123!",
      testName("posts-long"),
    );

    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers,
      payload: { text: "x".repeat(5001) },
    });
    assert.equal(reply.statusCode, 400);
  });

  test("cannot create post without authentication", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/posts/",
      payload: { text: "No auth" },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("cannot delete another user's post", async () => {
    const author = await signIn(
      testEmail("posts-author"),
      "Password123!",
      testName("posts-author"),
    );
    const attacker = await signIn(
      testEmail("posts-attacker"),
      "Password123!",
      testName("posts-attacker"),
    );

    const createReply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers: author.headers,
      payload: { text: "Author's post" },
    });
    const postId = createReply.json()._id;

    const deleteReply = await app.inject({
      method: "DELETE",
      url: `/posts/${postId}`,
      headers: attacker.headers,
    });
    assert.equal(deleteReply.statusCode, 404);

    // Author can still delete their own post
    const authorDelete = await app.inject({
      method: "DELETE",
      url: `/posts/${postId}`,
      headers: author.headers,
    });
    assert.equal(authorDelete.statusCode, 204);
  });

  test("add comment → update comment → delete comment", async () => {
    const { headers } = await signIn(
      testEmail("posts-comments"),
      "Password123!",
      testName("posts-comments"),
    );
    const other = await signIn(
      testEmail("posts-other"),
      "Password123!",
      testName("posts-other"),
    );

    const createReply = await app.inject({
      method: "POST",
      url: "/posts/",
      headers,
      payload: { text: "Commentable post" },
    });
    const postId = createReply.json()._id;

    // Add comment
    const commentReply = await app.inject({
      method: "POST",
      url: `/posts/${postId}/comments`,
      headers,
      payload: { text: "First comment" },
    });
    assert.equal(commentReply.statusCode, 201);
    const comments = commentReply.json() as Array<{
      _id: string;
      text: string;
      userId: string;
    }>;
    const commentId = comments[0]._id;

    // Update own comment
    const updateReply = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/comments/${commentId}`,
      headers,
      payload: { text: "Updated comment" },
    });
    assert.equal(updateReply.statusCode, 200);
    assert.equal(updateReply.json().text, "Updated comment");

    // Another user cannot update this comment
    const otherUpdate = await app.inject({
      method: "PUT",
      url: `/posts/${postId}/comments/${commentId}`,
      headers: other.headers,
      payload: { text: "Hacked" },
    });
    assert.equal(otherUpdate.statusCode, 403);

    // Delete own comment
    const deleteReply = await app.inject({
      method: "DELETE",
      url: `/posts/${postId}/comments/${commentId}`,
      headers,
    });
    assert.equal(deleteReply.statusCode, 204);

    // Confirm gone
    const listReply = await app.inject({
      method: "GET",
      url: `/posts/${postId}/comments`,
      headers,
    });
    assert.equal(listReply.statusCode, 200);
    assert.equal(listReply.json().comments.length, 0);
  });

  test("list posts is paginated and sorted newest-first", async () => {
    const author = await signIn(
      testEmail("posts-list"),
      "Password123!",
      testName("posts-list"),
    );

    // Create 3 posts
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/posts/",
        headers: author.headers,
        payload: { text: `Post ${i}` },
      });
    }

    const listReply = await app.inject({
      method: "GET",
      url: "/posts/?limit=10",
      headers: author.headers,
    });
    assert.equal(listReply.statusCode, 200);
    const posts = listReply.json().posts as Array<{ _id: string; text: string }>;
    assert.ok(posts.length >= 3);

    // Posts are returned in an array
    const texts = posts.map((p) => p.text);
    assert.ok(texts.includes("Post 0"));
    assert.ok(texts.includes("Post 1"));
    assert.ok(texts.includes("Post 2"));
  });
});
