import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app, options, createApp } from "#app";
import { oauthStub, noDb } from "./helpers/plugin-overrides.ts";

const srcFile = (relative: string) =>
  fileURLToPath(new URL(`../src/${relative}`, import.meta.url));

describe("the real wiring", () => {
  let server: FastifyInstance;

  before(async () => {
    server = await createApp({
      logger: false,
      overrides: { oauth: oauthStub, db: noDb },
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
    assert.equal(server.hasRoute({ method: "GET", url: "/no-such-route" }), false);
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

  test("every plugin file in src/plugins is registered in app.ts", () => {
    const appSource = readFileSync(srcFile("app.ts"), "utf8");
    const files = readdirSync(srcFile("plugins/")).filter((f) =>
      f.endsWith(".ts"),
    );
    assert.ok(files.length > 0, "no plugin files found");
    for (const file of files) {
      assert.ok(
        appSource.includes(`#plugins/${file.replace(/\.ts$/, "")}`),
        `src/plugins/${file} is not imported by src/app.ts — add it to the registration list`,
      );
    }
  });
});

test("the default export is still a plugin the CLI can boot", async () => {
  const server = Fastify(options);
  await server.register(app, { overrides: { oauth: oauthStub, db: noDb } });
  await server.ready();
  assert.ok(server.hasRoute({ method: "POST", url: "/auth/login" }));
  await server.close();
});
