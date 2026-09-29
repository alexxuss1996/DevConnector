import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import rateLimitPlugin from "#plugins/rate-limit";

/** The plugin with a `/ping` route to spend budget against. */
const build = async (
  keyGenerator?: (request: import("fastify").FastifyRequest) => string,
) => {
  const instance = Fastify({ logger: false });
  await instance.register(rateLimitPlugin, { keyGenerator });
  instance.get("/ping", async () => ({ ok: true }));
  await instance.ready();
  return instance;
};

/** Fires 150 requests and counts how many the limiter rejected. */
const hammer = async (instance: FastifyInstance) => {
  let limited = 0;
  for (let i = 0; i < 150; i++) {
    const res = await instance.inject({ method: "GET", url: "/ping" });
    if (res.statusCode === 429) limited++;
  }
  return limited;
};

/** Fetches until the limiter rejects, so the 429 body can be asserted on. */
const hammerUntilLimited = async (instance: FastifyInstance) => {
  for (let i = 0; i < 150; i++) {
    const res = await instance.inject({ method: "GET", url: "/ping" });
    if (res.statusCode === 429) return res;
    assert.equal(res.statusCode, 200);
  }
  throw new Error("expected a 429 response");
};

describe("rate limiting (global 100/minute)", () => {
  let app: FastifyInstance;

  after(async () => {
    await app.close();
  });

  test("allows requests under the limit", async () => {
    app = await build();
    const reply = await app.inject({ method: "GET", url: "/ping" });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), { ok: true });
  });

  test("returns 429 with RATE_LIMIT_EXCEEDED once the limit is passed", async () => {
    // Shares the instance above, so its 100-request budget is partly spent.
    const limited = await hammerUntilLimited(app);
    const body = limited.json() as any;
    assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    assert.equal(body.statusCode, 429);
    assert.equal(typeof body.retryAfter, "string");
    assert.equal(typeof body.message, "string");
  });
});

describe("per-request keying", () => {
  test("the default keyer shares one bucket, so the limit is reached", async () => {
    const app = await build();
    const limited = await hammer(app);
    await app.close();
    // 150 requests against max: 100 means exactly the 50 over budget. Pinning
    // the number catches a keyer that was ignored but returned distinct
    // values on only some requests, which `> 0` would wave through.
    assert.equal(limited, 50, "the plugin's max: 100 should reject 50 of 150");
  });

  test("a per-request keyer gives every request its own bucket", async () => {
    const app = await build(() => randomUUID());
    const limited = await hammer(app);
    await app.close();
    assert.equal(limited, 0, "no request should be limited");
  });
});
