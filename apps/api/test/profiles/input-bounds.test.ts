import { describe, test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parsePagination } from "@dev-conn/contracts";
import Profile from "#modules/profiles/profiles.model";
import {
  newId,
  mkProfile,
  mkQuery,
  stubMethod,
  restoreAllStubs,
} from "../helpers/stubs.ts";
import { signAccessToken } from "../helpers/app.ts";
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createRateLimitedTestApp } from "../helpers/test-app.ts";
import type { FastifyInstance } from "fastify";

/**
 * The profile body is written straight to Mongo, so an unbounded field is a
 * way to push a document at the 16MB BSON limit. The ceilings below are the
 * boundary cases: exactly at the cap is accepted, one character over is not.
 */
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

function authHeader() {
  return {
    authorization: `Bearer ${signAccessToken(app, { sub: newId().toString() })}`,
  };
}

/**
 * Stubs a successful write. Every case calls this, including the ones that
 * expect a rejection: a payload that slips past validation then reaches a
 * stubbed service and answers 201/200, so the failure is a wrong status code
 * rather than a hang against a real database.
 */
function stubWrites() {
  const doc = mkProfile({ status: "Developer", skills: ["JS"] });
  stubMethod(Profile, "findOneAndUpdate", () => mkQuery(doc as any));
  stubMethod(Profile, "exists", () => Promise.resolve(null));
  stubMethod(Profile, "create", ((d: any) =>
    Promise.resolve(mkProfile({ ...d } as any))) as any);
}

async function post(payload: Record<string, unknown>) {
  stubWrites();
  return app.inject({
    method: "POST",
    url: "/profiles/",
    headers: authHeader(),
    payload,
  });
}

async function patch(payload: Record<string, unknown>) {
  stubWrites();
  return app.inject({
    method: "PATCH",
    url: "/profiles/",
    headers: authHeader(),
    payload,
  });
}

const TEXT_LIMITS: Array<[field: string, limit: number]> = [
  ["company", 200],
  ["location", 200],
  ["status", 200],
  ["githubusername", 39],
  ["bio", 500],
];

describe("profile input bounds — create", () => {
  for (const [field, limit] of TEXT_LIMITS) {
    test(`accepts ${field} at ${limit} characters`, async () => {
      const reply = await post({
        status: "Developer",
        skills: ["JS"],
        [field]: "a".repeat(limit),
      });
      assert.equal(reply.statusCode, 201, reply.body);
    });

    test(`rejects ${field} at ${limit + 1} characters`, async () => {
      const reply = await post({
        status: "Developer",
        skills: ["JS"],
        [field]: "a".repeat(limit + 1),
      });
      assert.equal(reply.statusCode, 400, reply.body);
      assert.equal(reply.json().code, "VALIDATION_ERROR");
    });
  }

  test("accepts 50 skills", async () => {
    const reply = await post({
      status: "Developer",
      skills: Array.from({ length: 50 }, (_, i) => `skill-${i}`),
    });
    assert.equal(reply.statusCode, 201, reply.body);
  });

  test("rejects 51 skills", async () => {
    const reply = await post({
      status: "Developer",
      skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
    });
    assert.equal(reply.statusCode, 400, reply.body);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("rejects a single oversized skill string", async () => {
    const reply = await post({
      status: "Developer",
      skills: ["a".repeat(101)],
    });
    assert.equal(reply.statusCode, 400, reply.body);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });

  test("accepts a skill string at 100 characters", async () => {
    const reply = await post({
      status: "Developer",
      skills: ["a".repeat(100)],
    });
    assert.equal(reply.statusCode, 201, reply.body);
  });
});

describe("profile input bounds — update", () => {
  for (const [field, limit] of TEXT_LIMITS) {
    test(`accepts ${field} at ${limit} characters`, async () => {
      const reply = await patch({ [field]: "a".repeat(limit) });
      assert.equal(reply.statusCode, 200, reply.body);
    });

    test(`rejects ${field} at ${limit + 1} characters`, async () => {
      const reply = await patch({ [field]: "a".repeat(limit + 1) });
      assert.equal(reply.statusCode, 400, reply.body);
      assert.equal(reply.json().code, "VALIDATION_ERROR");
    });
  }

  test("accepts 50 skills", async () => {
    const reply = await patch({
      skills: Array.from({ length: 50 }, (_, i) => `skill-${i}`),
    });
    assert.equal(reply.statusCode, 200, reply.body);
  });

  test("rejects 51 skills", async () => {
    const reply = await patch({
      skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
    });
    assert.equal(reply.statusCode, 400, reply.body);
    assert.equal(reply.json().code, "VALIDATION_ERROR");
  });
});

describe("parsePagination page clamp", () => {
  test("clamps a page beyond the maximum", () => {
    const { page, limit } = parsePagination({ page: "99999999999999999999" });
    assert.ok(page <= 10_000, `page escaped the clamp: ${page}`);
    assert.ok(Number.isSafeInteger((page - 1) * limit));
  });

  test("clamps an exponent-notation page", () => {
    assert.equal(parsePagination({ page: "1e5" }).page, 10_000);
  });

  test("keeps an in-range hexadecimal-looking literal inside the clamp", () => {
    // Number("0x10") is 16, which is a legal page; the point is that no
    // spelling of a number can produce a page outside [1, max].
    for (const raw of ["0x10", "1e5", "-3", "0", " 7 ", "Infinity", "1.9"]) {
      const { page } = parsePagination({ page: raw });
      assert.ok(
        Number.isSafeInteger(page) && page >= 1 && page <= 10_000,
        `page "${raw}" parsed to ${page}`,
      );
    }
  });

  test("still falls back to page 1 for junk", () => {
    assert.equal(parsePagination({ page: "abc" }).page, 1);
    assert.equal(parsePagination({}).page, 1);
  });
});
