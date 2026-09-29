import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { app, options, createApp } from "#app";
import { oauthStub, noDb } from "./helpers/plugin-overrides.ts";

const srcFile = (relative: string) =>
  fileURLToPath(new URL(`../src/${relative}`, import.meta.url));

const testFile = (relative: string) =>
  fileURLToPath(new URL(`./${relative}`, import.meta.url));

describe("the real wiring", () => {
  let server: FastifyInstance;

  before(async () => {
    server = await createApp({
      logger: false,
      overrides: {
        oauth: oauthStub,
        db: noDb,
        rateLimitKey: () => randomUUID(),
      },
    });
  });
  after(async () => {
    await server.close();
  });

  // hasRoute, not printRoutes: printRoutes renders a tree with common
  // prefixes factored out, so "auth/login" never appears verbatim in it.
  test("mounts every route autoload discovers", () => {
    for (const [method, url] of [
      ["POST", "/auth/login"],
      ["POST", "/auth/logout-all"],
      ["GET", "/profiles/me"],
      ["PUT", "/posts/:id/like"],
    ] as const) {
      assert.ok(
        server.hasRoute({ method, url }),
        `expected route ${method} ${url} to be mounted`,
      );
    }
    assert.equal(
      server.hasRoute({ method: "GET", url: "/no-such-route" }),
      false,
    );
  });

  test("registers cors, which the old harness never loaded", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/",
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(
      res.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
  });

  test("registers helmet, which the old harness never loaded", async () => {
    const res = await server.inject({ method: "GET", url: "/" });
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  test("registers the real swagger plugin's docs route", async () => {
    const res = await server.inject({ method: "GET", url: "/docs" });
    assert.notEqual(res.statusCode, 404);
  });

  // Proves the plugin is passed to a register() call, not merely imported:
  // an import with a forgotten register() compiles and the plugin never
  // loads, which is the same silence the compiler cannot catch.
  test("every plugin file in src/plugins is registered in app.ts", () => {
    const appSource = readFileSync(srcFile("app.ts"), "utf8");
    const files = readdirSync(srcFile("plugins/")).filter((f) =>
      f.endsWith(".ts"),
    );
    assert.ok(files.length > 0, "no plugin files found");

    // Map the local identifier each plugin is imported as to the file it
    // came from — `rate-limit` is imported as `rateLimitPlugin`. The db and
    // oauth plugins are registered through the `overrides` destructure rather
    // than under their import name, so accept either.
    const registered = new Set(
      [...appSource.matchAll(/register\(\s*(\w+)/g)].map((m) => m[1]),
    );
    const viaOverride = new Set(
      [...appSource.matchAll(/=\s*(\w+Plugin)\b/g)].map((m) => m[1]),
    );
    const importedFrom = new Map(
      [
        ...appSource.matchAll(
          /^\s*import\s+(\w+)\s+from\s+"#plugins\/([\w-]+)"/gm,
        ),
      ].map((m) => [m[2], m[1]]),
    );

    for (const file of files) {
      const name = file.replace(/\.ts$/, "");
      const identifier = importedFrom.get(name);
      assert.ok(
        identifier,
        `src/plugins/${file} is not imported by src/app.ts — add it to the import list`,
      );
      assert.ok(
        registered.has(identifier) || viaOverride.has(identifier),
        `src/app.ts imports ${identifier} from #plugins/${name} but never passes it to register() — the plugin would never load`,
      );
    }
  });
  // Without rateLimitKey the real per-IP keying applies, so the production
  // budget on /auth/login (5/minute) trips. Every other suite overrides the
  // key and therefore never reaches this path — the rate limiter's
  // errorResponseBuilder meeting the app's own error handler, which is what
  // production does, is only observable here.
  // no-rate-limit-key: tripping the real budget is the point of this test.
  test("a tripped route budget returns the API's 429 shape", async () => {
    const strict = await createApp({
      logger: false,
      overrides: { oauth: oauthStub, db: noDb },
    });
    let last = await strict.inject({
      method: "POST",
      url: "/auth/login",
      payload: {},
    });
    for (let i = 0; i < 6; i++) {
      last = await strict.inject({
        method: "POST",
        url: "/auth/login",
        payload: {},
      });
    }

    assert.equal(last.statusCode, 429);
    const body = last.json();
    assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    assert.equal(typeof body.retryAfter, "string");
    assert.equal(body.requestId, last.headers["x-request-id"]);
    // The limiter's own headers must survive the app's error handler. It
    // sends addHeadersOnExceeding, which is retry-after only — the
    // x-ratelimit-* headers are not set on a rejected request.
    assert.ok(
      Number(last.headers["retry-after"]) > 0,
      `expected a retry-after header, got ${last.headers["retry-after"]}`,
    );
    await strict.close();
  });
});

// fastify-cli does `fastify.register(app, { ...options })` against a
// Fastify(options) root — see start.js. Mirroring that rather than passing
// {overrides} means a future required option on the app would fail here too,
// instead of the test passing and production breaking.
/**
 * Walks every `createApp(` call in the test tree and returns the call sites
 * that do not pass a `rateLimitKey`.
 */
function createAppCallsWithoutRateLimitKey(): string[] {
  const root = testFile("");
  const offenders: string[] = [];

  for (const entry of readdirSync(root, { recursive: true })) {
    const name = String(entry);
    if (!name.endsWith(".test.ts")) continue;
    const source = readFileSync(testFile(name), "utf8");

    for (let at = source.indexOf("createApp("); at !== -1; ) {
      // Walk to the matching close paren so the argument text is the call,
      // not the rest of the file.
      let depth = 0;
      let end = at;
      for (; end < source.length; end++) {
        if (source[end] === "(") depth++;
        else if (source[end] === ")" && --depth === 0) break;
      }
      const call = source.slice(at, end + 1);
      const before = source.slice(Math.max(0, at - 200), at);

      const optedOut =
        call.includes("rateLimitKey") || before.includes("no-rate-limit-key:");
      if (!optedOut) {
        const line = source.slice(0, at).split("\n").length;
        offenders.push(`${name}:${line}`);
      }
      at = source.indexOf("createApp(", end + 1);
    }
  }
  return offenders;
}

test("every createApp call in the test tree keys the rate limiter", () => {
  // The real limiter is on and budgets are the production ones, so a suite
  // that fires more than 100 requests at one address starts failing with a
  // 429 that has nothing to do with what it is testing. Passing
  // `rateLimitKey` moves the bucket per request and leaves the budget real.
  //
  // The default cannot live in createApp itself: defaulting it to a per-
  // request key would silently switch rate limiting OFF in production for
  // any caller who forgot the argument, and a DoS control should fail shut.
  // A test that greps the call sites is what makes the convention a
  // guarantee. A site that genuinely needs production keying opts out with
  // a `no-rate-limit-key:` comment saying why.
  assert.deepEqual(createAppCallsWithoutRateLimitKey(), []);
});

test("the default export is still a plugin the CLI can boot", async () => {
  const server = Fastify(options);
  await server.register(app, {
    ...options,
    overrides: { oauth: oauthStub, db: noDb },
  });
  await server.ready();
  assert.ok(server.hasRoute({ method: "POST", url: "/auth/login" }));
  await server.close();
});
