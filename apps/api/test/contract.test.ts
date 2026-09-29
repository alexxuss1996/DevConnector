import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FormatRegistry, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  AuthResponseSchema,
  CommentSchema,
  PostSchema,
  ProfileListResponseSchema,
  ProfileResponseSchema,
  PublicProfileSummarySchema,
} from "@dev-conn/contracts";

import Profile from "#modules/profiles/profiles.model";
import Post from "#modules/posts/posts.model";
import { profileService } from "#modules/profiles/profiles.service";
import { postService } from "#modules/posts/posts.service";
import {
  newId,
  mkProfile,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "./helpers/stubs.ts";
import { oauthStub, noDb } from "./helpers/plugin-overrides.ts";
import { createRateLimitedTestApp } from "./helpers/test-app.ts";
import type { FastifyInstance } from "fastify";

// `format` is declared throughout the contracts but TypeBox only enforces a
// format once it is registered, and rejects an unknown one outright. Registering
// all four the contracts use is what makes the assertions below mean anything —
// without them a date assertion would pass against any string at all. These
// mirror the JSON Schema definitions.
FormatRegistry.Set("date", (value) => {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
});
FormatRegistry.Set("date-time", (value) => {
  if (typeof value !== "string") return false;
  return !Number.isNaN(Date.parse(value));
});
FormatRegistry.Set("email", (value) => {
  if (typeof value !== "string" || value.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
});
FormatRegistry.Set("uri", (value) => {
  if (typeof value !== "string") return false;
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
});

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

/**
 * The web's types come from @dev-conn/contracts, but nothing checked that the
 * bytes the API actually returns satisfy those schemas: no route declares a
 * response schema, and the existing response-contract test asserts individual
 * fields by hand. Drift between the two therefore only surfaced in the browser,
 * as a render crash far from the change that caused it. This closes that in CI.
 */
function assertMatchesContract(label: string, schema: TSchema, value: unknown) {
  const errors = [...Value.Errors(schema, value)];
  assert.deepEqual(
    errors.map((e) => ({ path: e.path, message: e.message })),
    [],
    `${label} does not satisfy its published contract`,
  );
}

describe("API responses satisfy the published contracts", () => {
  test("a public profile response matches ProfileResponseSchema", async () => {
    const userId = newId();
    // Shaped as Mongoose serialises it: subdocument `_id`s are hex strings and
    // the owner is a populated object, not a bare id.
    const doc = mkProfile({
      userId,
      status: "Senior Developer",
      company: "Acme Corp",
      location: "Berlin, DE",
      skills: ["TypeScript", "Rust"],
      website: "https://example.com",
      githubusername: "octocat",
      social: { twitter: "https://twitter.com/octocat" },
      experience: [
        {
          _id: newId().toString(),
          title: "Developer",
          company: "Acme Corp",
          from: "2022-01-01",
          to: "2024-06-01",
          current: false,
        },
      ],
      education: [
        {
          _id: newId().toString(),
          school: "Uni",
          degree: "BSc",
          fieldofstudy: "Computer Science",
          from: "2018-09-01",
          to: "2021-07-01",
          current: false,
        },
      ],
    } as never);
    stubMethod(Profile, "findOne", () => mkQuery(doc));

    const profile = await profileService.getProfile(userId.toString());

    assertMatchesContract("GET /profiles/user/:id", ProfileResponseSchema, {
      profile,
    });
  });

  test("a profile list response matches ProfileListResponseSchema", async () => {
    const doc = mkProfile({ status: "Developer", skills: ["Go"] } as never);
    stubMethod(Profile, "find", () => mkQuery([doc]));
    stubMethod(Profile, "estimatedDocumentCount", () => Promise.resolve(1));

    const page = await profileService.getProfiles(1, 20);

    assertMatchesContract(
      "GET /profiles/",
      ProfileListResponseSchema,
      { profiles: page.profiles, total: page.total, page: 1, limit: 20 },
    );
    // A summary card must not carry the heavy fields.
    for (const summary of page.profiles) {
      assertMatchesContract("summary card", PublicProfileSummarySchema, summary);
    }
  });

  test("a post response matches PostSchema", async () => {
    const userId = newId();
    // getPost populates `userId`, and the route returns the document as-is, so
    // the owner arrives as an object rather than a bare id string.
    const post = {
      _id: newId().toString(),
      userId: { _id: userId.toString(), name: "Test User", avatar: "" },
      name: "Test User",
      avatar: "",
      text: "hello world",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      likes: [{ userId: userId.toString() }],
      comments: [
        {
          _id: newId().toString(),
          userId: userId.toString(),
          name: "Test User",
          avatar: "",
          text: "nice",
          createdAt: "2026-01-02T04:00:00.000Z",
        },
      ],
    };
    stubMethod(Post, "findById", () => mkQuery(post as never));

    const result = await postService.getPost(newId().toString());

    assertMatchesContract("GET /posts/:id", PostSchema, result);
    for (const comment of result.comments) {
      assertMatchesContract("comment", CommentSchema, comment);
    }
  });

  test("the auth response matches AuthResponseSchema", () => {
    // login/register/refresh all return this envelope. No schema described it
    // before, so the web's auth client was typed `Promise<AuthUser>` while the
    // API sent a token pair alongside the user.
    const response = {
      user: {
        id: newId().toString(),
        name: "Test User",
        email: "test@example.com",
        avatar: "https://example.com/avatar.png",
      },
      accessToken: "a.b.c",
      refreshToken: "d.e.f",
    };

    assertMatchesContract("POST /auth/login", AuthResponseSchema, response);
  });
});
