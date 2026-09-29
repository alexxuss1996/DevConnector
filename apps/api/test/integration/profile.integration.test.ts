import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  appendDbSuffix,
  cleanDb,
  testEmail,
  testName,
  toLocalMongoUri,
} from "../helpers/integration.ts";
import { oauthStub } from "../helpers/plugin-overrides.ts";
import { createRateLimitedTestApp } from "../helpers/test-app.ts";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

let app: FastifyInstance;

before(async () => {
  const runId = randomUUID().slice(0, 8);
  const baseUri =
    process.env.MONGODB_URI ?? "mongodb://localhost:27018/devconnector_test";
  // Per-run database and secret, so parallel runs do not collide. Both are
  // read by src/config/env and src/plugins/mongoose at registration time,
  // which happens inside createApp below — after these assignments.
  process.env.MONGODB_URI = appendDbSuffix(toLocalMongoUri(baseUri), runId);
  process.env.JWT_SECRET = `test-jwt-secret-${randomUUID().slice(0, 16)}`;
  process.env.FRONTEND_URL = "http://localhost:3000";

  app = await createRateLimitedTestApp({
    oauth: oauthStub,
    // `db` is deliberately absent: integration tests want the real mongoose
    // plugin and a real connection.,
  });
});

after(async () => {
  await app.close();
});

beforeEach(async () => {
  await cleanDb(app);
});

describe("integration — profile", () => {
  test("create profile → read own → read by id → update → verify", async () => {
    const email = testEmail("profile");
    const password = "Password123!";
    const name = testName("profile");
    const userId = (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name, email, password },
      })
    ).json().id;

    const headers = { authorization: "" };
    let accessToken = "";

    // Login
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });
    assert.equal(login.statusCode, 200);
    accessToken = login.cookies.find((c) => c.name === "access_token")!.value;
    headers.authorization = `Bearer ${accessToken}`;

    // Create profile
    const createReply = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: {
        status: "Developer",
        skills: ["JavaScript", "TypeScript"],
        company: "Acme Corp",
        website: "https://example.com",
      },
    });
    assert.equal(createReply.statusCode, 201);
    const profile = createReply.json().profile as {
      _id: string;
      status: string;
      skills: string[];
      company: string;
      website: string;
    };
    assert.equal(profile.status, "Developer");
    assert.deepEqual(profile.skills, ["JavaScript", "TypeScript"]);
    assert.equal(profile.company, "Acme Corp");

    // Read own profile via /profiles/me
    const meReply = await app.inject({
      method: "GET",
      url: "/profiles/me",
      headers,
    });
    assert.equal(meReply.statusCode, 200);
    assert.equal((meReply.json().profile as any).status, "Developer");

    // Read by user id (public)
    const byIdReply = await app.inject({
      method: "GET",
      url: `/profiles/user/${userId}`,
    });
    assert.equal(byIdReply.statusCode, 200);
    assert.equal((byIdReply.json().profile as any).status, "Developer");

    // Update profile
    const updateReply = await app.inject({
      method: "PATCH",
      url: "/profiles/",
      headers,
      payload: { company: "Globex Inc", bio: "Full-stack dev" },
    });
    assert.equal(updateReply.statusCode, 200);
    const updated = updateReply.json().profile as any;
    assert.equal(updated.company, "Globex Inc");
    assert.equal(updated.bio, "Full-stack dev");
    assert.equal(updated.status, "Developer"); // unchanged
  });

  test("cannot create profile without authentication", async () => {
    const reply = await app.inject({
      method: "POST",
      url: "/profiles/",
      payload: { status: "Dev", skills: ["JS"] },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("cannot create profile with missing required fields", async () => {
    const { headers } = await setupBasicUser(testEmail("invalid-profile"));
    const reply = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: { skills: ["JS"] }, // missing status
    });
    assert.equal(reply.statusCode, 400);
    assert.equal((reply.json() as { code: string }).code, "VALIDATION_ERROR");
  });

  test("cannot update another user's profile", async () => {
    const userA = await setupBasicUser(testEmail("profile-a"));
    const userB = await setupBasicUser(testEmail("profile-b"));

    // Create profiles
    await app.inject({
      method: "POST",
      url: "/profiles/",
      headers: userA.headers,
      payload: { status: "Designer", skills: ["Figma"] },
    });
    await app.inject({
      method: "POST",
      url: "/profiles/",
      headers: userB.headers,
      payload: { status: "PM", skills: ["Jira"] },
    });

    // User B tries to overwrite User A's profile
    const reply = await app.inject({
      method: "PATCH",
      url: "/profiles/",
      headers: userB.headers,
      payload: { status: "Hacked", skills: ["Phishing"] },
    });
    assert.equal(reply.statusCode, 200);
    // The profile returned belongs to B (their own), not A's
    const updated = reply.json().profile as any;
    assert.equal(updated.status, "Hacked");

    // Verify A's profile is unchanged
    const aProfile = await app.inject({
      method: "GET",
      url: "/profiles/me",
      headers: userA.headers,
    });
    assert.equal((aProfile.json().profile as any).status, "Designer");
  });

  test("social URLs are accepted and invalid ones rejected", async () => {
    const { headers } = await setupBasicUser(testEmail("social"));
    // Valid https URL
    const valid = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: {
        status: "Dev",
        skills: ["JS"],
        twitter: "https://twitter.com/jane",
      },
    });
    assert.equal(valid.statusCode, 201);
    assert.equal(
      (valid.json().profile as any).social.twitter,
      "https://twitter.com/jane",
    );

    // Invalid (non-URI)
    const invalid = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: {
        status: "Dev",
        skills: ["JS"],
        website: "not-a-url",
      },
    });
    assert.equal(invalid.statusCode, 400);
  });

  test("public profile listing returns all profiles", async () => {
    // Create 3 users with profiles
    for (let i = 0; i < 3; i++) {
      const email = testEmail(`list-${i}`);
      const { headers } = await setupBasicUser(email);
      await app.inject({
        method: "POST",
        url: "/profiles/",
        headers,
        payload: {
          status: `Role ${i}`,
          skills: ["Skill"],
        },
      });
    }

    const listReply = await app.inject({
      method: "GET",
      url: "/profiles/?limit=50",
    });
    assert.equal(listReply.statusCode, 200);
    const profiles = listReply.json().profiles as Array<{ status: string }>;
    assert.ok(profiles.length >= 3);
  });

  test("profile with githubusername is accepted", async () => {
    const { headers } = await setupBasicUser(testEmail("github"));
    const reply = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: {
        status: "Dev",
        skills: ["JS"],
        githubusername: "octocat",
      },
    });
    assert.equal(reply.statusCode, 201);
    assert.equal((reply.json().profile as any).githubusername, "octocat");
  });

  // The cascade declares it "falls back to non-transactional on standalone
  // Mongo", but `startTransaction()` does not throw on standalone — it fails at
  // the first operation, which is already inside the outer try. Against the
  // standalone server the integration harness uses, that made this route return
  // 500 and delete nothing.
  test("DELETE /profiles/ succeeds on a standalone (non-replica-set) server", async () => {
    const email = testEmail("delete-account");
    const { headers } = await setupBasicUser(email);

    const created = await app.inject({
      method: "POST",
      url: "/profiles/",
      headers,
      payload: { status: "Dev", skills: ["JS"] },
    });
    assert.equal(created.statusCode, 201, "profile must exist before deleting");

    const before = await app.inject({
      method: "GET",
      url: "/profiles/me",
      headers,
    });
    assert.equal(before.statusCode, 200, "profile must be readable before delete");

    const reply = await app.inject({
      method: "DELETE",
      url: "/profiles/",
      headers,
    });
    assert.equal(
      reply.statusCode,
      204,
      `account deletion failed: ${reply.statusCode} ${reply.body}`,
    );

    // The cascade must actually have run. With the user row gone the access
    // token no longer resolves, so auth rejects before the profile lookup runs.
    const after = await app.inject({
      method: "GET",
      url: "/profiles/me",
      headers,
    });
    assert.ok(
      after.statusCode === 401 || after.statusCode === 404,
      `account should be unusable after delete, got ${after.statusCode}`,
    );

    // And the profile document itself is gone from the public directory.
    const list = await app.inject({ method: "GET", url: "/profiles/?limit=50" });
    assert.equal(list.statusCode, 200);
    const remaining = list.json().profiles as Array<{ status: string }>;
    assert.equal(
      remaining.filter((p) => p.status === "Dev").length,
      0,
      "deleted profile should not appear in the public listing",
    );
  });

});

async function setupBasicUser(email: string) {
  const password = "Password123!";
  const name = testName("user");
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password },
  });
  const loginReply = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  assert.equal(loginReply.statusCode, 200);
  const accessToken = loginReply.cookies.find(
    (c) => c.name === "access_token",
  )!.value;
  return {
    headers: { authorization: `Bearer ${accessToken}` },
  };
}
