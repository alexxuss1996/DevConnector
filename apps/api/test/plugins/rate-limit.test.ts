import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import rateLimitPlugin from "#plugins/rate-limit";

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

describe("per-request keying", () => {
  const build = async (keyGenerator?: (request: unknown) => string) => {
    const instance = Fastify({ logger: false });
    await instance.register(rateLimitPlugin, { keyGenerator });
    instance.get("/ping", async () => ({ ok: true }));
    await instance.ready();
    return instance;
  };

  const hammer = async (instance: FastifyInstance) => {
    let limited = 0;
    for (let i = 0; i < 150; i++) {
      const res = await instance.inject({ method: "GET", url: "/ping" });
      if (res.statusCode === 429) limited++;
    }
    return limited;
  };

  test("the default keyer shares one bucket, so the limit is reached", async () => {
    const app = await build();
    const limited = await hammer(app);
    await app.close();
    assert.ok(limited > 0, "the plugin should have limited some requests");
  });

  test("a per-request keyer gives every request its own bucket", async () => {
    const app = await build(() => randomUUID());
    const limited = await hammer(app);
    await app.close();
    assert.equal(limited, 0, "no request should be limited");
  });
});
