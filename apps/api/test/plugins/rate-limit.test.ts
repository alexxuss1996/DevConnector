import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import rateLimitPlugin from "#plugins/rate-limit";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = Fastify({ logger: false });
  await app.register(rateLimitPlugin);
  app.get("/ping", async () => ({ ok: true }));
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("rate limiting (global 100/minute)", () => {
  test("allows requests under the limit", async () => {
    const reply = await app.inject({ method: "GET", url: "/ping" });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), { ok: true });
  });

  test("returns 429 with RATE_LIMIT_EXCEEDED once the limit is passed", async () => {
    let limited: any = null;
    // 1 request already spent above; fire enough to cross max: 100.
    for (let i = 0; i < 105; i++) {
      const reply = await app.inject({ method: "GET", url: "/ping" });
      if (reply.statusCode === 429) {
        limited = reply;
        break;
      }
      assert.equal(reply.statusCode, 200);
    }
    assert.ok(limited, "expected a 429 response");
    const body = limited.json() as any;
    assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    assert.ok(typeof body.retryAfter !== "undefined" || typeof body.message === "string");
  });
});
