import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import csrfPlugin from "#plugins/csrf";
import type { FastifyInstance } from "fastify";

const allowedOrigin = new URL(
  process.env.FRONTEND_URL ?? "http://localhost:3000",
).origin;

interface InjectResponse {
  statusCode: number;
  json: () => any;
}

let app: FastifyInstance;

before(async () => {
  app = Fastify({ logger: false });
  await app.register(fastifyCookie);
  await app.register(csrfPlugin);
  app.post("/mutate", async () => ({ ok: true }));
  app.get("/read", async () => ({ ok: true }));
  await app.ready();
});

after(async () => {
  await app.close();
});

function inject(
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string> = {},
): Promise<InjectResponse> {
  return app.inject({ method, url, headers });
}

const WITH_AUTH_COOKIE = { cookie: "access_token=stub" };

describe("csrf plugin", () => {
  test("allows safe methods even with auth cookies and an evil origin", async () => {
    const reply = await inject("GET", "/read", {
      ...WITH_AUTH_COOKIE,
      origin: "https://evil.example",
    });
    assert.equal(reply.statusCode, 200);
  });

  test("allows mutations without auth cookies regardless of origin", async () => {
    const reply = await inject("POST", "/mutate", {
      origin: "https://evil.example",
    });
    assert.equal(reply.statusCode, 200);
  });

  test("allows mutations with auth cookies and no origin/referer", async () => {
    const reply = await inject("POST", "/mutate", WITH_AUTH_COOKIE);
    assert.equal(reply.statusCode, 200);
  });

  test("allows mutations with auth cookies from the frontend origin", async () => {
    const reply = await inject("POST", "/mutate", {
      ...WITH_AUTH_COOKIE,
      origin: allowedOrigin,
    });
    assert.equal(reply.statusCode, 200);
  });

  test("allows mutations with a referer from the frontend origin", async () => {
    const reply = await inject("POST", "/mutate", {
      ...WITH_AUTH_COOKIE,
      referer: `${allowedOrigin}/settings`,
    });
    assert.equal(reply.statusCode, 200);
  });

  test("blocks mutations with auth cookies from a foreign origin", async () => {
    const reply = await inject("POST", "/mutate", {
      ...WITH_AUTH_COOKIE,
      origin: "https://evil.example",
    });
    assert.equal(reply.statusCode, 403);
    assert.deepEqual(reply.json(), {
      code: "FORBIDDEN",
      message: "Invalid origin",
    });
  });

  test("blocks mutations with an unparseable origin", async () => {
    const reply = await inject("POST", "/mutate", {
      ...WITH_AUTH_COOKIE,
      origin: "not a url",
    });
    assert.equal(reply.statusCode, 403);
  });
});