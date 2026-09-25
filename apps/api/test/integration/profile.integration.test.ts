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

describe("integration — profile", () => {
  test("create profile → read own → read by id → update → verify", async () => {
    const email = testEmail("profile");
    const password = "Password123!";
    const name = testName("profile");
    const userId = (await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name, email, password },
    })).json().id;

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
      url: "/profile/",
      headers,
      payload: {
        status: "Developer",
        skills: ["JavaScript", "TypeScript"],
        company: "Acme Corp",
        website: "https://example.com",
      },
    });
    assert.equal(createReply.statusCode, 200);
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

    // Read own profile via /profile/me
    const meReply = await app.inject({
      method: "GET",
      url: "/profile/me",
      headers,
    });
    assert.equal(meReply.statusCode, 200);
    assert.equal((meReply.json().profile as any).status, "Developer");

    // Read by user id (public)
    const byIdReply = await app.inject({
      method: "GET",
      url: `/profile/user/${userId}`,
    });
    assert.equal(byIdReply.statusCode, 200);
    assert.equal((byIdReply.json().profile as any).status, "Developer");

    // Update profile
    const updateReply = await app.inject({
      method: "PUT",
      url: "/profile/",
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
      url: "/profile/",
      payload: { status: "Dev", skills: ["JS"] },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("cannot create profile with missing required fields", async () => {
    const { headers } = await setupBasicUser(testEmail("invalid-profile"));
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
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
      url: "/profile/",
      headers: userA.headers,
      payload: { status: "Designer", skills: ["Figma"] },
    });
    await app.inject({
      method: "POST",
      url: "/profile/",
      headers: userB.headers,
      payload: { status: "PM", skills: ["Jira"] },
    });

    // User B tries to overwrite User A's profile
    const reply = await app.inject({
      method: "PUT",
      url: "/profile/",
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
      url: "/profile/me",
      headers: userA.headers,
    });
    assert.equal((aProfile.json().profile as any).status, "Designer");
  });

  test("social URLs are accepted and invalid ones rejected", async () => {
    const { headers } = await setupBasicUser(testEmail("social"));
    // Valid https URL
    const valid = await app.inject({
      method: "POST",
      url: "/profile/",
      headers,
      payload: {
        status: "Dev",
        skills: ["JS"],
        twitter: "https://twitter.com/jane",
      },
    });
    assert.equal(valid.statusCode, 200);
    assert.equal((valid.json().profile as any).social.twitter, "https://twitter.com/jane");

    // Invalid (non-URI)
    const invalid = await app.inject({
      method: "POST",
      url: "/profile/",
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
        url: "/profile/",
        headers,
        payload: {
          status: `Role ${i}`,
          skills: ["Skill"],
        },
      });
    }

    const listReply = await app.inject({
      method: "GET",
      url: "/profile/?limit=50",
    });
    assert.equal(listReply.statusCode, 200);
    const profiles = listReply.json().profiles as Array<{ status: string }>;
    assert.ok(profiles.length >= 3);
  });

  test("profile with githubusername is accepted", async () => {
    const { headers } = await setupBasicUser(testEmail("github"));
    const reply = await app.inject({
      method: "POST",
      url: "/profile/",
      headers,
      payload: {
        status: "Dev",
        skills: ["JS"],
        githubusername: "octocat",
      },
    });
    assert.equal(reply.statusCode, 200);
    assert.equal((reply.json().profile as any).githubusername, "octocat");
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
  const accessToken = loginReply.cookies.find((c) => c.name === "access_token")!.value;
  return {
    headers: { authorization: `Bearer ${accessToken}` },
  };
}
